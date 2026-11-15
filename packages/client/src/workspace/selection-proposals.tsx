import type { FormEvent } from 'react';
import type { Job,Patch } from '../lib/api';
import type { TextSelection } from './artifact-editor';
import { isAnalysisPatch } from './document-analysis';
import { RuntimeTimeline } from './runtime-timeline';

export const aiPresets = { 解释:'详细解释选中的内容',简化:'把选中内容改写得更简洁',展开:'扩展选中内容并保持原意',示例:'给选中内容补充简洁示例',公式:'用 LaTeX 补充适用公式',翻译:'将选中内容翻译成另一种语言，保留术语' };

export function SelectionProposals({ aiJob,selection,patches,canGenerate,synced,instruction,onInstruction,onResearch,onGenerate,onReview }:{
  aiJob:Job|null;selection:TextSelection|null;patches:Patch[];canGenerate:boolean;synced:boolean;instruction:string;
  onInstruction:(value:string)=>void;onResearch:(selection:TextSelection)=>void;onGenerate:(event:FormEvent<HTMLFormElement>)=>Promise<void>;
  onReview:(id:string,accept:boolean)=>Promise<void>;
}) {
  return <section className="stack">
    <h3>AI 修改提案</h3>
    {aiJob && <p role="status">正在生成提案…</p>}
    {aiJob?.runtime_session_id && <RuntimeTimeline key={aiJob.run_id} runId={aiJob.run_id} active cancellable />}
    {selection && canGenerate && synced ? <form className="stack" onSubmit={event => void onGenerate(event)}>
      <div className="button-row" aria-label="选区 AI 操作">
        {Object.entries(aiPresets).map(([label,preset]) =>
          <button type="button" key={label} onClick={() => onInstruction(preset)}>{label}</button>)}
        <button type="button" onClick={() => onResearch(selection)}>查找来源</button>
      </div>
      <label>修改要求<textarea name="instruction" required maxLength={1000} value={instruction} onChange={event => onInstruction(event.target.value)} placeholder="例如：压缩这段解释" /></label>
      <label className="check"><input required type="checkbox" />允许发送选区给外部模型</label>
      <button className="primary" disabled={Boolean(aiJob)}>生成提案</button>
    </form> : <p className="muted">选择文档中的一段文字。外部模型权限可在设置中开启。</p>}
    {patches.filter(patch => patch.status === 'proposed' && !isAnalysisPatch(patch)).map(patch => <div className="patch" key={patch.id}>
      {patch.reviewed === false && <p>请重新生成此提案。</p>}
      {patch.operations.map((operation,index) => <div key={index}>
        {operation.type === 'replace_text_range'
          ? <><del>{operation.expected_text}</del><ins>{operation.text}</ins></>
          : <span>{operation.type}</span>}
      </div>)}
      <div className="button-row"><button disabled={!synced || patch.reviewed === false} onClick={() => void onReview(patch.id,true)}>接受</button><button onClick={() => void onReview(patch.id,false)}>拒绝</button></div>
    </div>)}
  </section>;
}
