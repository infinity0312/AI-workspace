import { createCipheriv,createDecipheriv,randomBytes } from 'node:crypto';
import type { Database,Sql } from '../../platform/database';
import { first } from '../../platform/database';
import { AppError } from '../../platform/errors';
import { sha256,stableJson } from '../../platform/security';
import type { ToolJournal } from './loop';
import type { StreamCompletion } from './adapter';

export function openToolJournal(db:Database,sessionId:string,context:unknown,options:{
  assertLease:(sql:Sql)=>Promise<void>;authorize:()=>Promise<void>;secret?:string;
}):(ToolJournal & { settleIn:(sql:Sql,round:number,response:StreamCompletion)=>Promise<void> })|undefined {
  const secret=options.secret ?? process.env.AKW_RUNTIME_RECOVERY_KEY;
  if (!secret) return;
  if (!/^[0-9a-f]{64}$/i.test(secret)) throw new AppError(500,'RUNTIME_RECOVERY_CONFIGURATION','Invalid runtime recovery key');
  const key=Buffer.from(secret,'hex');
  const invocation=sha256(stableJson(context));
  const identity=(round:number,entry:string)=>Buffer.from(stableJson([sessionId,invocation,round,entry]));
  async function read<T>(round:number,entry:string) {
    const row=await first<{ sealed_payload:string }>(db,`SELECT sealed_payload FROM runtime_journal
      WHERE session_id=$1 AND invocation=$2 AND round_no=$3 AND entry_key=$4`,[sessionId,invocation,round,entry]);
    if (!row) return;
    await options.authorize();
    try {
      const payload=Buffer.from(row.sealed_payload,'base64');
      const decipher=createDecipheriv('aes-256-gcm',key,payload.subarray(0,12));
      decipher.setAAD(identity(round,entry));
      decipher.setAuthTag(payload.subarray(12,28));
      return JSON.parse(Buffer.concat([decipher.update(payload.subarray(28)),decipher.final()]).toString('utf8')) as T;
    } catch { throw new AppError(409,'RUNTIME_RECOVERY_UNAVAILABLE','The saved runtime response could not be recovered'); }
  }
  async function store(sql:Sql,round:number,entry:string,value:unknown) {
    const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);
    cipher.setAAD(identity(round,entry));
    const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
    const sealed=Buffer.concat([nonce,cipher.getAuthTag(),encrypted]).toString('base64');
    await sql.all(`INSERT INTO runtime_journal(session_id,invocation,round_no,entry_key,sealed_payload)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,[sessionId,invocation,round,entry,sealed]);
  }
  const save=(round:number,entry:string,value:unknown)=>db.transaction(async sql=>{
    await options.assertLease(sql);
    await store(sql,round,entry,value);
  });
  return {
    settleIn:(sql,round,response)=>store(sql,round,'response',response),
    response:round=>read(round,'response'),
    toolResult:(round,id)=>read(round,'tool:'+id),
    recordTool:(round,id,result)=>save(round,'tool:'+id,result),
  };
}
