import { Component, createContext, useContext, useState, type ComponentType, type ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChartBlock } from './chart-block';
import { checklistAttrs,externalInlineAttrs,guideStepAttrs,informationAttrs,taskGapAttrs,learningLessonAttrs,type Block } from '@akw/contracts';
import { AnalysisImage } from './analysis-image';
import { Latex, formulaSegments } from './latex';
import { ExternalLink } from './native-actions';
import { taskWarnings,WeatherView } from './task-experience';
import { LearningPractice,LessonMath } from './learning-experience';
import { ProjectionBlock, type ProjectionState } from './projection-views';

export type TextSelection = { block_id:string; inline_index:number; start_utf16:number; end_utf16:number };
export type RendererContext = {
  mode:'document'|'proposal'|'history'; onEvidence:(id:string)=>void;
  learning?:{ artifact:import('@akw/contracts').ArtifactDetail;editable:boolean;mastery:import('@akw/contracts').LearningMastery;
    onGraded:(id:string,score:import('@akw/contracts').LearningAssessmentResult)=>void };
  onSelection?:(value:TextSelection)=>void; projection?:ProjectionState; blocks?:Block[];
  onNode?:(id:string)=>void; onSource?:(id:string)=>void; onArtifact?:(id:string)=>void; onBlock?:(id:string)=>void; onUpdate?:(block:Block)=>void;
};
export type BlockRendererProps = { block:Block; context:RendererContext };
export type BlockRendererRegistry = Readonly<Record<string,ComponentType<BlockRendererProps>>>;

function Footnote({ note }:{ note:string }) {
  const [open,setOpen] = useState(false);
  return <span className="footnote"><button className="citation" aria-expanded={open} onClick={() => setOpen(!open)}>脚注</button>
    {open && <span className="detail footnote-text">{note}</span>}</span>;
}

function InlineText({ node,onEvidence,onNode,nodes,onSelect,code = false }:{
  node:NonNullable<Block['children']>[number]; onEvidence:(id:string)=>void;
  onNode?:(id:string)=>void; nodes?:ProjectionState['graph'];
  onSelect?:(start:number,end:number)=>void; code?:boolean;
}) {
  if (node.type === 'citation' && typeof node.attrs?.evidence_id === 'string') {
    const id = node.attrs.evidence_id;
    return <button className="citation" onClick={() => onEvidence(id)}>证据</button>;
  }
  if (node.type === 'wiki_link' && typeof node.attrs?.node_id === 'string') {
    const id = node.attrs.node_id;
    const title = nodes?.nodes.find(item => item.id === id)?.title ?? node.text ?? '知识节点';
    return onNode ? <button className="citation wiki-link" onClick={() => onNode(id)}>{title}</button> : <span>{title}</span>;
  }
  if (node.type === 'external_link') {
    const parsed=externalInlineAttrs.safeParse(node.attrs);
    return parsed.success ? <ExternalLink url={parsed.data.url} label={node.text || parsed.data.url} report={() => undefined} /> : <span>{node.text}</span>;
  }
  if (node.type === 'footnote' && typeof node.attrs?.note === 'string') return <Footnote note={node.attrs.note} />;
  if (node.type === 'math_inline') return <Latex source={String(node.attrs?.latex ?? node.text ?? '')} />;
  const marks = new Set(node.marks?.map(mark => mark.type));
  const source = node.text ?? '';
  const segments = code || marks.has('code') ? [{ kind:'text',value:source,start:0 }] : formulaSegments(source);
  return <span className={[marks.has('bold') ? 'bold' : '',marks.has('italic') ? 'italic' : '',marks.has('strike') ? 'strike' : '',
    marks.has('underline') ? 'underline' : '',marks.has('code') ? 'mono' : ''].join(' ')}>
    {segments.map((segment,index) => segment.kind === 'math'
      ? <Latex key={index} source={segment.value} display={'display' in segment && segment.display} />
      : <span key={index} onMouseUp={event => {
        const selection = window.getSelection();
        if (!onSelect || !selection?.rangeCount || selection.isCollapsed) return;
        const range = selection.getRangeAt(0);
        if (range.startContainer === range.endContainer && range.startContainer.parentElement === event.currentTarget)
          onSelect(segment.start + range.startOffset,segment.start + range.endOffset);
      }}>{segment.value}</span>)}
  </span>;
}

function Inlines({ block,context }:BlockRendererProps) {
  return <>{(block.children ?? []).map((node,index) => <InlineText key={node.id ?? index} node={node}
    onEvidence={context.onEvidence} onNode={context.onNode} nodes={context.projection?.graph} code={block.type === 'code_block'}
    onSelect={(start,end) => context.onSelection?.({ block_id:block.id,inline_index:index,start_utf16:start,end_utf16:end })} />)}</>;
}

function Heading(props:BlockRendererProps) {
  const { block,context } = props;
  const legacy = typeof block.attrs?.analysis_run_id === 'string' && block.attrs.analysis_verified !== true
    && block.children?.length === 1 && /^(?:AI 分析（基于所选来源，待复核）|AI 分析草稿（未经资料验证）)$/.test(block.children[0]?.text ?? '');
  const content = legacy ? '历史分析' : <Inlines {...props} />;
  if (context.mode !== 'document') return <h4>{content}</h4>;
  const level = Number(block.attrs?.level ?? 2);
  const Tag = level === 3 ? 'h3' : level === 4 ? 'h4' : level === 5 ? 'h5' : level === 6 ? 'h6' : 'h2';
  return <Tag>{content}</Tag>;
}
const projectionRenderer = ({ block,context }:BlockRendererProps) =>
  <ProjectionBlock block={block} projection={context.projection} onEvidence={context.onEvidence}
    onNode={context.onNode} onSource={context.onSource} onBlock={context.onBlock} />;

function CitationCard({ block,context }:BlockRendererProps) {
  const { references,nodes } = context.projection?.graph ?? {};
  const id = String(block.attrs?.source_id ?? block.attrs?.artifact_id ?? block.attrs?.node_id ?? '');
  const source = block.type === 'source_embed' ? references?.sources.find(item => item.id === id) : undefined;
  const artifact = block.type === 'artifact_embed' ? references?.artifacts.find(item => item.id === id) : undefined;
  const node = block.type === 'knowledge_embed' ? nodes?.find(item => item.id === id) : undefined;
  const action = source ? context.onSource : artifact ? context.onArtifact : node ? context.onNode : undefined;
  const label = String(block.attrs?.title || source?.title || artifact?.title || node?.title || '引用对象');
  return <aside className="detail stack"><strong>{label}</strong>
    {source && <p>{[source.metadata.author,source.metadata.published,source.metadata.doi && 'DOI ' + source.metadata.doi].filter(Boolean).join(' · ')}</p>}
    {(artifact?.excerpt || node?.description) && <p className="excerpt">{artifact?.excerpt || node?.description}</p>}
    {action ? <div><button onClick={() => action(id)}>打开{source ? '来源' : artifact ? '文档' : '知识节点'}</button></div> :
      <p className="muted">{context.projection?.status === 'loading' ? '正在加载引用…' : source || artifact || node ? '' : '引用对象暂不可用。'}</p>}
  </aside>;
}

function ListBlock({ block,context }:BlockRendererProps) {
  const Tag = block.type === 'ordered_list' ? 'ol' : 'ul';
  return <Tag className="document-list">{(block.children ?? []).map((node,index) =>
    <li key={node.id ?? index}><InlineText node={node} onEvidence={context.onEvidence} onNode={context.onNode} nodes={context.projection?.graph}
      onSelect={(start,end) => context.onSelection?.({ block_id:block.id,inline_index:index,start_utf16:start,end_utf16:end })} /></li>)}</Tag>;
}

function ChecklistBlock({ block,context }:BlockRendererProps) {
  const parsed = checklistAttrs.safeParse(block.attrs);
  if (!parsed.success) return <p className="muted">此交互块的类型暂不可用。</p>;
  const { items,title } = parsed.data;
  const complete = items.filter(item => item.done).length;
  return <section className="detail stack" aria-label={title || '交互清单'}>
    <strong>{title || '交互清单'}</strong>
    <div className="button-row"><progress aria-label="清单进度" value={complete} max={items.length} /> {complete} / {items.length}</div>
    {items.map((item,index) => <label className="check" key={index}><input type="checkbox" checked={item.done} disabled={!context.onUpdate}
      onChange={event => context.onUpdate?.({ ...block,attrs:{ ...block.attrs,items:items.map((entry,i) => i===index ? { ...entry,done:event.target.checked } : entry) } })} />
      {item.text}</label>)}
  </section>;
}

const builtIn:BlockRendererRegistry = {
  interactive:ChecklistBlock,
  markdown: ({ block }) => <div className="rendered-markdown"><Markdown skipHtml disallowedElements={['img','iframe']} remarkPlugins={[remarkGfm]}>{
    String(block.attrs?.markdown ?? block.children?.map(node => node.text ?? '').join('') ?? '')}</Markdown></div>,
  bullet_list:ListBlock,ordered_list:ListBlock,list_item:props => <p><Inlines {...props} /></p>,
  chart:({ block,context }) => <ChartBlock block={block} blocks={context.blocks} />,
  source_embed:CitationCard,artifact_embed:CitationCard,knowledge_embed:CitationCard,
  paragraph: props => <p><Inlines {...props} /></p>,
  heading: Heading,
  image: ({ block,context }) => <AnalysisImage block={block} onEvidence={context.onEvidence} />,
  figure: ({ block,context }) => <AnalysisImage block={block} onEvidence={context.onEvidence} />,
  quote: props => <blockquote><Inlines {...props} /></blockquote>,
  callout: props => <aside className="detail"><Inlines {...props} /></aside>,
  code_block: props => <div>{typeof props.block.attrs?.language === 'string' && props.block.attrs.language &&
    <small className="muted">{props.block.attrs.language}</small>}<pre><code><Inlines {...props} /></code></pre></div>,
  task_gap:({ block })=>{
    const gap=taskGapAttrs.safeParse(block.attrs);
    return gap.success ? <aside className="detail"><strong>{gap.data.goal}</strong><p>{
      taskWarnings[gap.data.code] ?? '仅保留本部分已核对的资料。'}</p></aside> : null;
  },
  weather_forecast:props=><WeatherView attrs={props.block.attrs} evidence={<Inlines {...props} />} />,
  information_summary:props=>{
    const details=informationAttrs.safeParse(props.block.attrs);
    return details.success ? <section className="stack" aria-label="问题与答案">
      <h2>{details.data.goal}</h2><p><Inlines {...props} /></p><small className="muted">{details.data.scope}</small>
    </section> : null;
  },
  guide_step:props=>{
    const details=guideStepAttrs.safeParse(props.block.attrs);
    return details.success ? <section className="stack" aria-label={'第 '+details.data.number+' 步'}>
      <h3>{details.data.number}. {details.data.title}</h3><p><Inlines {...props} /></p>
    </section> : null;
  },
  learning_goal:()=>null,
  learning_lesson:({ block,context })=>{
    const details=learningLessonAttrs.safeParse(block.attrs);
    if (!details.success) return null;
    const learning=context.learning;
    return <section className="stack" aria-label={details.data.title}>
      <h2>{details.data.title}</h2><strong>{details.data.objective}</strong>
      {details.data.prerequisites.length>0 && <div className="button-row">
        {details.data.prerequisites.map(id=>{
          const title=context.blocks?.find(block=>block.id===id)?.attrs?.title;
          return typeof title==='string' && context.onBlock && <button key={id} onClick={()=>context.onBlock?.(id)}>先修：{title}</button>;
        })}
      </div>}
      <p className="excerpt"><Inlines block={block} context={context} /></p>
      <LessonMath block={block} />
      {learning && <LearningPractice key={block.id} block={block} artifact={learning.artifact} editable={learning.editable}
        mastery={learning.mastery.find(item=>item.lesson_id===block.id)} onGraded={score=>learning.onGraded(block.id,score)} />}
    </section>;
  },
  math_block: ({ block }) => <Latex display source={String(block.attrs?.latex ?? '')} />,
  divider: () => <hr />,
  evidence_reference: ({ block,context }) => typeof block.attrs?.evidence_id === 'string'
    ? <button className="citation" onClick={() => context.onEvidence(String(block.attrs?.evidence_id))}>查看证据</button> : <p className="muted">证据不可用。</p>,
  table: ({ block }) => Array.isArray(block.attrs?.rows)
    ? <div className="table-wrap"><table>{block.attrs.title && <caption>{String(block.attrs.title)}</caption>}<tbody>{block.attrs.rows.filter(Array.isArray).map((row,i) => <tr key={i}>{row.map((cell,j) =>
      <td key={j}>{formulaSegments(String(cell)).map((item,k) => item.kind === 'math' ? <Latex key={k} source={item.value} display={item.display} /> : item.value)}</td>)}</tr>)}</tbody></table></div>
    : <p className="muted">表格数据不可用。</p>,
  mindmap:projectionRenderer,timeline:projectionRenderer,graph_embed:projectionRenderer,
  dependency_graph:projectionRenderer,evidence_network:projectionRenderer,
};
export function createArtifactRendererRegistry(overrides:BlockRendererRegistry = {}):BlockRendererRegistry {
  return Object.freeze({ ...builtIn,...overrides });
}
export const defaultArtifactRenderers = createArtifactRendererRegistry();
const ArtifactRenderers = createContext(defaultArtifactRenderers);
export function ArtifactRendererProvider({ registry,children }:{ registry:BlockRendererRegistry; children:ReactNode }) {
  return <ArtifactRenderers.Provider value={registry}>{children}</ArtifactRenderers.Provider>;
}

class RenderBoundary extends Component<{ children:ReactNode },{ failed:boolean }> {
  state = { failed:false };
  static getDerivedStateFromError() { return { failed:true }; }
  render() { return this.state.failed ? <p className="muted">此内容块暂时无法显示。</p> : this.props.children; }
}
export function ArtifactBlockView({ block,context,registry }: BlockRendererProps & { registry?:BlockRendererRegistry }) {
  const inherited = useContext(ArtifactRenderers);
  const active = registry ?? inherited;
  const Renderer = Object.hasOwn(active,block.type) ? active[block.type] : undefined;
  return <RenderBoundary key={block.id + ':' + block.type}>{Renderer ? <Renderer block={block} context={context} />
    : <div className="placeholder">结构化内容 · {block.type} <Inlines block={block} context={context} /></div>}</RenderBoundary>;
}
