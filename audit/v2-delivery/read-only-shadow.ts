import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import '../../apps/api/src/config';
import { modelGateway } from '../../apps/api/src/runtime/providers';
import { deepSeekStreamingGateway } from '../../apps/api/src/runtime/harness/adapter';
import { runtimePrompt } from '../../apps/api/src/runtime/harness/context';
import { runToolLoop } from '../../apps/api/src/runtime/harness/loop';
import { researchDocument } from '../../apps/api/src/runtime/document-research';
import { prompts,type QualityModel } from '../../apps/api/src/quality-engine/prompts';

async function main() {
  const key=process.env.DEEPSEEK_API_KEY;
  const legacy=modelGateway();
  if (!key || !legacy) throw new Error('Missing DeepSeek configuration');
  const gateway=deepSeekStreamingGateway(key,legacy.profile?.model ?? 'deepseek-flash');
  const goal='Use the supplied synthetic experiment to state the observed result, without inferring any other conditions.';
  const id=randomUUID();
  const options={
    goal,source:async()=>[{ id,kind:'source' as const,title:'Synthetic calibration',quote:'A lab calibration reported that the prototype passed 7 out of 9 trials under the stated setup.' }],
    stage:async <T>(_key:unknown,work:()=>Promise<T>)=>work(),
  };
  const outcomes=[];
  for (const mode of ['legacy','sse'] as const) {
    const signal=AbortSignal.timeout(60000);
    let input=0,output=0,calls=0;
    const model:QualityModel=async (prompt,payload)=>{
      const entry=prompts[prompt];
      const json=entry.format==='json_object';
      if (mode==='legacy') {
        const response=await legacy.generate(entry.system,payload,2400,signal,json);
        calls++;input+=response.input;output+=response.output;
        return response.text;
      }
      const context=runtimePrompt(prompt,payload,{ skills:false,tools:false,compaction:false });
      return runToolLoop({ messages:context.messages,json,signal,stepId:randomUUID(),report:async()=>{},
        send:async messages=>{
          const response=await gateway.complete({ messages,json,maxOutput:2400 },signal);
          calls++;input+=response.input;output+=response.output;
          return response;
        } });
    };
    const started=Date.now();
    const checked=await researchDocument({ ...options,model });
    const claims=checked.report.sections.flatMap(section=>section.claims);
    const grounded=claims.some(claim=>claim.text.includes('7 out of 9') && claim.evidence_ids.includes(id));
    assert.equal(grounded,true);
    outcomes.push({ mode,elapsed_ms:Date.now()-started,calls,input_tokens:input,output_tokens:output,grounded });
  }
  console.log(JSON.stringify({ case:'synthetic calibration',persisted:false,outcomes }));
}
void main().catch(error=>{console.error(error instanceof Error ? error.message : 'Shadow fixture failed');process.exitCode=1;});
