import type { Database,Sql } from '../../platform/database';
import { denied } from '../../platform/errors';
import type { Actor } from '../../platform/security';
import { workspace } from '../access';

export async function assertExternal(db:Database,actor:Actor,id:string,sql:Sql=db) {
  const { policy } = await workspace(sql,actor,id);
  if (!policy.externalProviderAllowed || !['public','personal'].includes(policy.sensitivity)) throw denied();
}
