import { randomUUID } from 'node:crypto';
import type { ArtifactComment, CommentInput, CommentUpdate, WorkspaceMember } from '@akw/contracts';
import { first, type Database } from '../platform/database';
import { conflict, denied, missing } from '../platform/errors';
import type { Actor } from '../platform/security';
import { event, idempotent, workspace } from './access';
import { Artifacts } from './artifacts';

const commentColumns = 'id,artifact_id,revision_id,block_id,author_id,original_author_id,body,version,created_at,resolved_at,resolved_by';
export class Collaboration {
  constructor(private readonly db:Database,private readonly artifacts:Artifacts) {}

  async members(actor:Actor,ws:string) {
    await workspace(this.db,actor,ws);
    return this.db.all<WorkspaceMember>('SELECT user_id,role,version FROM workspace_memberships WHERE workspace_id=$1 ORDER BY role,user_id',[ws]);
  }

  member(actor:Actor,ws:string,input:{ user_id:string; role:'editor'|'viewer'|'remove'; version:number },key?:string) {
    return this.db.transaction(async sql => {
      const access = await workspace(sql,actor,ws,true);
      if (access.role !== 'owner') throw denied();
      return idempotent(sql,actor,'member.update:' + ws,key,input,async () => {
        const current = await first<WorkspaceMember>(sql,'SELECT user_id,role,version FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2',[ws,input.user_id]);
        if (current?.role === 'owner') throw denied();
        if ((current?.version ?? 0) !== input.version) throw conflict('CONFLICT_MEMBERSHIP_VERSION','Membership changed');
        if (input.role === 'remove') {
          if (!current) throw missing('Member');
          await sql.all('DELETE FROM workspace_memberships WHERE workspace_id=$1 AND user_id=$2',[ws,input.user_id]);
        } else {
          if (!await first(sql,'SELECT user_id FROM tenant_memberships WHERE tenant_id=$1 AND user_id=$2',[actor.tenant,input.user_id])) throw missing('Tenant account');
          await sql.all(`INSERT INTO workspace_memberships(workspace_id,user_id,role) VALUES($1,$2,$3)
            ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=EXCLUDED.role,version=workspace_memberships.version+1`,
            [ws,input.user_id,input.role]);
        }
        await event(sql,actor,ws,'WorkspaceMemberChanged','workspace',ws,1,{ user_id:input.user_id,role:input.role });
        return { user_id:input.user_id,role:input.role,version:(current?.version ?? 0)+1 };
      });
    });
  }

  async comments(actor:Actor,id:string) {
    await this.artifacts.get(actor,id);
    return this.db.all<ArtifactComment>('SELECT ' + commentColumns +
      ' FROM artifact_comments WHERE artifact_id=$1 ORDER BY (resolved_at IS NULL) DESC,created_at DESC LIMIT 200',[id]);
  }

  comment(actor:Actor,id:string,input:CommentInput,key?:string) {
    return this.db.transaction(async sql => {
      const artifact = await this.artifacts.get(actor,id,sql,true);
      return idempotent(sql,actor,'comment.create:' + id,key,input,async () => {
        if (input.revision_id !== artifact.revision.id) throw conflict('CONFLICT_ARTIFACT_VERSION','Open the latest revision before commenting');
        if (input.block_id && !artifact.revision.content_json.blocks.some(block => block.id === input.block_id)) throw missing('Block');
        const row = await first<ArtifactComment>(sql,`INSERT INTO artifact_comments(id,artifact_id,revision_id,block_id,author_id,body)
          VALUES($1,$2,$3,$4,$5,$6) RETURNING ` + commentColumns,
          [randomUUID(),id,input.revision_id,input.block_id ?? null,actor.user,input.body]);
        await event(sql,actor,artifact.workspace_id,'ArtifactCommentAdded','artifact_comment',row!.id,1,{ artifact_id:id });
        return row!;
      });
    });
  }

  updateComment(actor:Actor,id:string,comment:string,input:CommentUpdate,key?:string) {
    return this.db.transaction(async sql => {
      const artifact = await this.artifacts.get(actor,id,sql);
      const access = await workspace(sql,actor,artifact.workspace_id,true);
      return idempotent(sql,actor,'comment.change:' + comment,key,{ id,...input },async () => {
        const current = await first<ArtifactComment>(sql,'SELECT ' + commentColumns + ' FROM artifact_comments WHERE id=$1 AND artifact_id=$2',[comment,id]);
        if (!current) throw missing('Comment');
        if (access.role !== 'owner' && current.author_id !== actor.user) throw denied();
        const row = await first<ArtifactComment>(sql,`UPDATE artifact_comments SET resolved_at=CASE WHEN $3 THEN now() END,
          resolved_by=CASE WHEN $3 THEN $4 END,version=version+1 WHERE id=$1 AND version=$2 RETURNING ` + commentColumns,
          [comment,input.version,input.resolved,actor.user]);
        if (!row) throw conflict('CONFLICT_COMMENT_VERSION','Comment has changed');
        await event(sql,actor,artifact.workspace_id,input.resolved ? 'ArtifactCommentResolved' : 'ArtifactCommentReopened',
          'artifact_comment',comment,row.version,{ artifact_id:id });
        return row;
      });
    });
  }
}
