import { stableJson } from '../platform/security';

export class BudgetExceeded extends Error {
  constructor() { super('Run budget exhausted'); this.name = 'BudgetExceeded'; }
}
export type ModelBudget = { max_calls:number;max_tokens:number;max_output?:number };
export function reserveModelBudget(
  policy: ModelBudget, used: { calls: number; tokens: number }, system: string, payload: unknown,
) {
  // Byte count plus message overhead is a conservative upper bound for this text gateway.
  const input = Buffer.byteLength(system + stableJson(payload)) + 128;
  const output = Math.min(policy.max_output ?? 2000,policy.max_tokens-used.tokens-input);
  if (used.calls >= policy.max_calls || output < 128) throw new BudgetExceeded();
  return { input, output };
}
