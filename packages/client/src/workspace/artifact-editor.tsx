import { useEffect, useState } from 'react';
import { artifactDocument, externalInlineAttrs, isProjectionType, type ArtifactDocument, type Block, type WorkspaceProjection } from '@akw/contracts';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Node, type JSONContent } from '@tiptap/core';
import { post,errorText } from '../lib/api';
import { StructuredEditor, structuredTypes } from './structured-editor';
import type { Evidence } from '../lib/api';
import { ArtifactBlockView,type RendererContext, type TextSelection } from './artifact-renderer';
import { ProjectionEditor } from './projection-editor';
import { projectionLabels, type ProjectionState } from './projection-views';
import { Latex } from './latex';
import { ExternalLink, sourcePageLabel } from './native-actions';

export type { TextSelection } from './artifact-renderer';

type Inline = NonNullable<Block['children']>[number];
const referenceTypes = ['citation','wiki_link','math_inline','external_link','footnote'];
const ReferenceAtom = Node.create({
  name:'workspaceReference',group:'inline',inline:true,atom:true,
  addAttributes:() => ({ canonical:{ default:null,rendered:false } }),
  renderHTML:({ node }) => {
    const value = node.attrs.canonical as Inline|undefined;
    return ['span',{ class:'reference-token',contenteditable:'false' },
      value?.type === 'citation' ? '证据引用' : value?.type === 'math_inline' ? '行内公式' : value?.type === 'footnote' ? '脚注' : value?.text ?? '知识链接'];
  },
});

function RichText({ block,graph,workspace,project,save,split,close }:{
  block:Block; graph?:WorkspaceProjection; workspace:string; project:string|null; save:(block:Block)=>void; split?:(before:Block,after:Block)=>void; close:()=>void;
}) {
  const textNodes = block.children ?? [];
  const [mode,setMode] = useState<'wiki'|'citation'|'formula'|'link'|'footnote'>('wiki');
  const [choice,setChoice] = useState('');
  const [query,setQuery] = useState('');
  const [error,setError] = useState('');
  const [adding,setAdding] = useState(false);
  const available = graph?.nodes ?? [];
  const matching = available.filter(node => node.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const evidence = graph?.references?.evidence ?? [];
  const editor = useEditor({
    immediatelyRender:false,
    extensions:[ReferenceAtom,StarterKit.configure({ link:false, blockquote:false, bulletList:false, orderedList:false, codeBlock:false, heading:false, horizontalRule:false })],
    content:{ type:'doc',content:[{ type:'paragraph',content:textNodes.flatMap((node):JSONContent[] => node.type !== 'text' ? [{ type:'workspaceReference',attrs:{ canonical:node } }] : (node.text ?? '').split('\n').flatMap((text,index) => {
      const result: JSONContent[] = index ? [{ type:'hardBreak' }] : [];
      if (text) result.push({ type:'text',text,marks:node.marks?.filter(mark => ['bold','italic','strike','code','underline'].includes(mark.type)).map(mark => ({ type:mark.type })) });
      return result;
    })) }] },
    editorProps:{ attributes:{ 'aria-label':'编辑文字',role:'textbox','aria-multiline':'true' } },
  });
  function serialize(paragraphs:JSONContent[]) {
    const children: Inline[] = [];
    for (const [i, paragraph] of paragraphs.entries()) {
      if (i) children.push({ type:'text',text:'\n' });
      for (const node of paragraph.content ?? []) {
        if (node.type === 'hardBreak') children.push({ type:'text',text:'\n' });
        if (node.type === 'workspaceReference' && node.attrs?.canonical) children.push(node.attrs.canonical as Inline);
        if (node.type === 'text' && node.text) {
          const marks = node.marks?.map(mark => ({ type:mark.type }));
          let cursor = 0;
          for (const match of node.text.matchAll(/\[\[([^\][\n]{1,160})\]\]/g)) {
            const matches = available.filter(item => item.title.trim().toLocaleLowerCase() === match[1]!.trim().toLocaleLowerCase());
            if (matches.length !== 1) continue;
            if (match.index > cursor) children.push({ type:'text',text:node.text.slice(cursor,match.index),marks });
            children.push({ type:'wiki_link',text:matches[0]!.title,attrs:{ node_id:matches[0]!.id } });
            cursor = match.index+match[0].length;
          }
          if (cursor < node.text.length) children.push({ type:'text',text:node.text.slice(cursor),marks });
        }
      }
    }
    return children;
  }
  function submit() { save({ ...block,children:serialize(editor?.getJSON().content ?? []) }); }
  function splitAtCursor() {
    if (!editor || !split) return;
    const { doc,selection } = editor.state;
    const position = selection.$from;
    if (!selection.empty || position.depth < 1) { setError('请将光标放在拆分位置。'); return; }
    const index = position.index(0);
    const paragraph = doc.child(index);
    const before = serialize([...(doc.toJSON().content ?? []).slice(0,index),paragraph.cut(0,position.parentOffset).toJSON()]);
    const after = serialize([paragraph.cut(position.parentOffset).toJSON(),...(doc.toJSON().content ?? []).slice(index+1)]);
    if (!before.length || !after.length) { setError('请把光标放在要拆分的位置，确保前后都有内容。'); return; }
    split({ ...block,children:before },{ id:crypto.randomUUID(),type:'paragraph',children:after });
  }
  const insert = (value:Inline) => { editor?.chain().focus().insertContent({ type:'workspaceReference',attrs:{ canonical:value } }).run(); };
  function insertReference() {
    const text = choice.trim();
    const url = mode === 'link' ? externalInlineAttrs.safeParse({ url:text }) : undefined;
    if (mode === 'link' && !url?.success) { setError('输入有效的 HTTP 或 HTTPS 链接。'); return; }
    setError('');
    insert(mode === 'footnote' ? { type:'footnote',attrs:{ note:text } } : url?.success ?
      { type:'external_link',text:query.trim() || url.data.url,attrs:url.data } : mode === 'formula' ? { type:'math_inline',attrs:{ latex:text } } :
      mode === 'citation' ? { type:'citation',attrs:{ evidence_id:text } } : { type:'wiki_link',text:matching.find(item => item.id === text)?.title,attrs:{ node_id:text } });
    setChoice('');
  }
  async function createNode() {
    if (!query.trim() || adding) return;
    setAdding(true);
    try {
      const node = await post<{ id:string; title:string }>('/knowledge/nodes',{ workspace_id:workspace,project_id:project,title:query.trim(),type:'concept' });
      insert({ type:'wiki_link',text:node.title,attrs:{ node_id:node.id } });
      setQuery('');
    } catch (problem) { setError(errorText(problem)); }
    finally { setAdding(false); }
  }
  return <div className="block-edit">
    <div className="button-row">
      <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()}>粗体</button>
      <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()}>斜体</button>
      <button type="button" onClick={() => editor?.chain().focus().toggleStrike().run()}>删除线</button>
      <button type="button" onClick={() => editor?.chain().focus().toggleUnderline().run()}>下划线</button>
      <button type="button" onClick={() => editor?.chain().focus().toggleCode().run()}>行内代码</button>
      <button type="button" onClick={() => editor?.chain().focus().undo().run()}>撤销</button>
      <button type="button" onClick={() => editor?.chain().focus().redo().run()}>重做</button>
    </div>
    <EditorContent editor={editor} />
    <details><summary>插入知识链接、证据或公式</summary><div className="stack">
      <label>插入类型<select value={mode} onChange={event => { setMode(event.target.value as typeof mode); setChoice(''); setQuery(''); }}>
        <option value="wiki">知识链接</option><option value="citation">原文证据</option><option value="formula">行内公式</option>
        <option value="link">网页链接</option><option value="footnote">脚注</option>
      </select></label>
      {mode === 'wiki' && <label>查找或新建节点<input value={query} maxLength={160} onChange={event => setQuery(event.target.value)} /></label>}
      {mode === 'link' && <label>链接文字<input maxLength={160} value={query} onChange={event => setQuery(event.target.value)} /></label>}
      {mode === 'link' ? <label>网址<input type="url" maxLength={2048} value={choice} onChange={event => setChoice(event.target.value)} /></label> :
        mode === 'footnote' ? <label>脚注内容<textarea maxLength={1000} value={choice} onChange={event => setChoice(event.target.value)} /></label> :
        mode === 'formula' ? <label>行内 LaTeX<input value={choice} maxLength={12000} onChange={event => setChoice(event.target.value)} /></label> :
        <label>选择引用<select value={choice} onChange={event => setChoice(event.target.value)}><option value="">请选择</option>
          {(mode === 'wiki' ? matching : evidence).map(item => <option key={item.id} value={item.id}>{item.title}{'quote' in item && ' · ' + String(item.quote).slice(0,45)}</option>)}</select></label>}
      <div className="button-row"><button type="button" disabled={!choice.trim()} onClick={insertReference}>插入到光标位置</button>
        {mode === 'wiki' && query.trim() && !available.some(item => item.title.toLocaleLowerCase() === query.trim().toLocaleLowerCase()) &&
          <button type="button" disabled={adding} onClick={() => void createNode()}>创建并链接节点</button>}
      </div>
    </div></details>
    {error && <p role="alert">{error}</p>}
    <div className="button-row"><button className="primary" type="button" onClick={submit} disabled={!editor}>保存内容块</button>
      {split && <button type="button" disabled={!editor} onClick={splitAtCursor}>在光标处拆分</button>}
      <button type="button" onClick={close}>取消</button></div>
  </div>;
}
function InlineFields({ block, save, close }: { block: Block; save: (block: Block) => void; close: () => void }) {
  const [value,setValue] = useState(block);
  const latex = typeof block.attrs?.latex === 'string';
  const list = ['ordered_list','bullet_list'].includes(block.type);
  return <div className="block-edit">
    {latex && <Latex display source={String(value.attrs?.latex ?? '')} />}
    {latex && <label>LaTeX<textarea value={String(value.attrs?.latex ?? '')} onChange={event => setValue({ ...value,attrs:{ ...value.attrs,latex:event.target.value } })} /></label>}
    {block.type === 'markdown' && <label>Markdown<textarea value={String(value.attrs?.markdown ?? '')}
      onChange={event => setValue({ ...value,attrs:{ ...value.attrs,markdown:event.target.value } })} /></label>}
    {(value.children ?? []).map((node,index) => node.type === 'text' ? <label key={index}>文本 {index+1}
      <textarea value={node.text ?? ''} onChange={event => setValue({ ...value,children:value.children?.map((part,i) => i === index ? { ...part,text:event.target.value } : part) })} /></label>
      : <p key={index} className="muted">{node.type === 'citation' ? '已绑定证据引用' : node.type}</p>)}
    {list && <div className="button-row"><button onClick={() => setValue({ ...value,children:[...(value.children ?? []),{ type:'text',text:'' }] })}>添加列表项</button>
      <button disabled={!value.children?.length} onClick={() => setValue({ ...value,children:value.children?.slice(0,-1) })}>删除末项</button></div>}
    <div className="button-row"><button className="primary" onClick={() => save(value)}>保存内容块</button><button onClick={close}>取消</button></div>
  </div>;
}

export function ArtifactEditor({ content,editable,projection,workspace,project,onSave,onEvidence,onSelection,onInspect,links,report,learning }: {
  content:ArtifactDocument; editable:boolean; projection?:ProjectionState; workspace:string; project:string|null;
  links:Pick<RendererContext,'onNode'|'onSource'|'onArtifact'|'onBlock'>; report:(message:string)=>void;
  learning?:RendererContext['learning'];
  onSave: (content: ArtifactDocument) => Promise<boolean>;
  onEvidence: (id: string) => void;
  onSelection: (selection: TextSelection) => void;
  onInspect:(id:string)=>void;
}) {
  const [editing,setEditing] = useState<string | null>(null);
  const [adding,setAdding] = useState(false);
  const [newType,setNewType] = useState('paragraph');
  const [newText,setNewText] = useState('');
  const [saving,setSaving] = useState(false);
  const [dragged,setDragged] = useState('');
  async function save(blocks: Block[]) {
    const parsed = artifactDocument.safeParse({ ...content,blocks });
    if (!parsed.success) { report(parsed.error.issues[0]?.message ?? '文档结构无效。'); return; }
    setSaving(true);
    try {
      if (await onSave(parsed.data)) { setEditing(null); setAdding(false); setNewText(''); }
    } finally { setSaving(false); }
  }
  function moveBefore(target:string) {
    if (saving || !dragged || dragged === target) return;
    const source = content.blocks.find(item => item.id === dragged);
    if (!source) return;
    const blocks=content.blocks.filter(item => item.id !== dragged);
    const at=blocks.findIndex(item => item.id === target);
    if (at >= 0) { blocks.splice(at,0,source); void save(blocks); }
  }
  function add() {
    const isView = isProjectionType(newType);
    const attrs = isView ? { view_version:1,node_ids:[],title:newText.trim() } : newType === 'heading' ? { level:2 } : newType === 'math_block' ? { latex:newText } : newType === 'markdown' ? { markdown:newText } : {};
    const children = isView || ['math_block','markdown','divider'].includes(newType) ? [] :
      ['bullet_list','ordered_list'].includes(newType) ? newText.split(/\r?\n/).filter(line => line.trim()).map(text => ({ type:'text',text })) : [{ type:'text',text:newText }];
    void save([...content.blocks,{ id:crypto.randomUUID(),type:newType,attrs:attrs as NonNullable<Block['attrs']>,children }]);
  }
  return <div className="artifact-content">
    {!content.blocks.length && <p className="muted">文档暂无正文。使用「AI 生成分析」整理参考资料，或切换编辑模式添加内容。</p>}
    {content.blocks.map((block,index) => {
      const isView = isProjectionType(block.type) && (block.attrs?.view_version == null || block.attrs.view_version === 1);
      const saveBlock = (updated:Block) => { if (!saving) void save(content.blocks.map(item => item.id === updated.id ? updated : item)); };
      const structured = (block.type !== 'interactive' || block.attrs?.kind === 'checklist') && Object.hasOwn(structuredTypes,block.type) && (block.type !== 'chart' || block.attrs?.chart_version === 1);
      const canEdit = isView || structured || ['paragraph','heading','quote','callout','code_block','math_block','markdown','bullet_list','ordered_list','learning_lesson','guide_step','information_summary'].includes(block.type);
      const previous=content.blocks[index-1];
      const canMerge=block.type === 'paragraph' && previous?.type === 'paragraph' && !Object.keys(block.attrs ?? {}).length && !Object.keys(previous.attrs ?? {}).length;
      const rich = ['paragraph','heading','quote','callout'].includes(block.type)
        && (block.children ?? []).every(node => referenceTypes.includes(node.type) || (node.type === 'text' && !node.id && !node.attrs
          && Object.keys(node).every(key => ['type','text','marks'].includes(key))
          && (node.marks ?? []).every(mark => !mark.attrs && ['bold','italic','strike','underline','code'].includes(mark.type))));
      return <section className="artifact-block" key={block.id} id={'block-' + block.id} tabIndex={-1}
        onDragOver={event => { if (dragged && editable && dragged !== block.id) { event.preventDefault(); event.dataTransfer.dropEffect='move'; } }}
        onDrop={event => { if (dragged && editable) { event.preventDefault(); moveBefore(block.id); setDragged(''); } }}>
        {editing === block.id && editable
          ? isView ? <ProjectionEditor block={block} projection={projection} close={() => setEditing(null)} save={saveBlock} />
            : structured ? <StructuredEditor block={block} blocks={content.blocks} graph={projection?.graph} workspace={workspace} close={() => setEditing(null)} save={saveBlock} />
            : rich ? <RichText block={block} graph={projection?.graph} workspace={workspace} project={project} close={() => setEditing(null)} save={saveBlock}
              split={block.type === 'paragraph' ? (before,after) => void save(content.blocks.flatMap(item => item.id === block.id ? [before,after] : [item])) : undefined} />
            : <InlineFields block={block} close={() => setEditing(null)} save={saveBlock} />
          : <>{block.attrs?.user_edited === true && <small className="muted">用户编辑</small>}<ArtifactBlockView block={block} context={{ ...links,mode:'document',onEvidence,onSelection,projection,learning,blocks:content.blocks,onUpdate:editable && !saving ? saveBlock : undefined }} />
            {editable && <div className="block-actions">
              {canEdit && <button disabled={saving} onClick={() => setEditing(block.id)}>编辑</button>}
              <button onClick={() => onInspect(block.id)}>属性</button>
              <span className="block-drag" draggable={!saving} title="拖到目标内容块上方" aria-hidden="true"
                onDragStart={event => { event.dataTransfer.setData('text/plain',block.id); event.dataTransfer.effectAllowed='move'; setDragged(block.id); }}
                onDragEnd={() => setDragged('')}>拖动</span>
              {canMerge && <button disabled={saving} onClick={() => {
                const merged={ ...previous!,children:[...(previous!.children ?? []),{ type:'text',text:'\n' },...(block.children ?? [])] };
                void save(content.blocks.flatMap(item => item.id === previous!.id ? [merged] : item.id === block.id ? [] : [item]));
              }}>合并到上一段</button>}
              <button aria-label="上移内容块" disabled={saving || index === 0} onClick={() => {
                const blocks = [...content.blocks]; [blocks[index-1],blocks[index]] = [blocks[index]!,blocks[index-1]!]; void save(blocks);
              }}>上移</button>
              <button aria-label="下移内容块" disabled={saving || index === content.blocks.length-1} onClick={() => {
                const blocks = [...content.blocks]; [blocks[index+1],blocks[index]] = [blocks[index]!,blocks[index+1]!]; void save(blocks);
              }}>下移</button>
              <button aria-label="复制内容块" disabled={saving} onClick={() => {
                const blocks=[...content.blocks]; blocks.splice(index+1,0,{ ...block,id:crypto.randomUUID() }); void save(blocks);
              }}>复制</button>
              <button aria-label="删除内容块" disabled={saving} onClick={() => {
                if (content.blocks.some(item => item.type === 'chart' && item.attrs?.table_id === block.id)) { report('此数据表正在被图表引用，请先解除关联。'); return; }
                void save(content.blocks.filter(item => item.id !== block.id));
              }}>删除</button>
            </div>}</>}
      </section>;
    })}
    {editable && (adding ? <div className="block-edit">
      <label>内容类型<select value={newType} onChange={event => setNewType(event.target.value)}>
        <option value="paragraph">段落</option><option value="heading">标题</option><option value="quote">引用</option><option value="code_block">代码</option><option value="math_block">公式</option><option value="bullet_list">无序列表</option><option value="ordered_list">有序列表</option><option value="markdown">Markdown</option>
        <option value="callout">提示块</option><option value="divider">分隔线</option>
        {Object.entries(structuredTypes).map(([id,label]) => <option key={id} value={id}>{label}</option>)}
        {Object.entries(projectionLabels).map(([id,label]) => <option key={id} value={id}>{label}</option>)}
      </select></label>
      {Object.hasOwn(structuredTypes,newType) ? <StructuredEditor key={newType} block={{ id:'new',type:newType }} blocks={content.blocks}
        graph={projection?.graph} workspace={workspace} close={() => setAdding(false)} save={value => void save([...content.blocks,{ ...value,id:crypto.randomUUID() }])} /> :
      <form className="stack" onSubmit={event => { event.preventDefault(); if (!saving) add(); }}>
      {isProjectionType(newType) ? <label>视图标题<input autoFocus value={newText} maxLength={160} onChange={event => setNewText(event.target.value)} /></label> :
        newType !== 'divider' && <label>内容<textarea autoFocus value={newText} onChange={event => setNewText(event.target.value)} /></label>}
      {newType === 'math_block' && newText.trim() && <Latex display source={newText} />}
      <div className="button-row"><button className="primary" disabled={saving}>保存内容块</button><button type="button" onClick={() => setAdding(false)}>取消</button></div>
    </form>}</div> : <button className="add-block" onClick={() => setAdding(true)}>＋ 添加内容块</button>)}
  </div>;
}

export function EvidencePanel({ evidence, close, propose, insert, read, report }: {
  evidence:Evidence|null; close:()=>void; propose?:(evidence:Evidence)=>void; insert?:(id:string)=>void; read?:(evidence:Evidence)=>void; report:(message:string)=>void;
}) {
  useEffect(() => {
    if (!evidence) return;
    function dismiss(event: KeyboardEvent) { if (event.key === 'Escape') close(); }
    window.addEventListener('keydown',dismiss);
    return () => window.removeEventListener('keydown',dismiss);
  },[evidence,close]);
  if (!evidence) return null;
  return <section><div className="section-heading"><h3>原文证据</h3><button onClick={close}>关闭</button></div>
    <p><strong>{evidence.title}</strong></p>
    {evidence.metadata && <p className="muted">{[
      evidence.metadata.provider,evidence.metadata.author,evidence.metadata.journal,evidence.metadata.published,
      evidence.metadata.doi ? 'DOI ' + evidence.metadata.doi : '',evidence.metadata.license,
    ].filter(Boolean).join(' · ')}</p>}
    <blockquote>{evidence.quote}</blockquote>
    <p className="muted">{sourcePageLabel(evidence.locator.page,evidence.parser_version)}段落 {evidence.locator.passage_ordinal+1} · 字符 {evidence.locator.start_utf16}–{evidence.locator.end_utf16}</p>
    {read && evidence.source_id && <button onClick={() => read(evidence)}>在检查器阅读来源</button>}
    {insert && <button onClick={() => insert(evidence.id)}>插入正文</button>}
    {propose && <button onClick={() => propose(evidence)}>基于此证据提议结论</button>}
    {evidence.canonical_url && <ExternalLink url={evidence.canonical_url} label="打开来源" report={report} />}
    {evidence.metadata?.license_url && /^https:\/\/creativecommons\.org\//.test(evidence.metadata.license_url) &&
      <ExternalLink url={evidence.metadata.license_url} label="许可条款" report={report} />}
  </section>;
}
