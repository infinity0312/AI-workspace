import { useState } from 'react';
import { chartAttrs, chartFromTable, checklistAttrs, imageAnnotations, type Block, type WorkspaceProjection } from '@akw/contracts';
import { errorText,post } from '../lib/api';
import { readFileBase64 } from '../lib/files';
import { ChartBlock } from './chart-block';
import { AnalysisImage } from './analysis-image';

const defaultRows = [['名称','数值'],['','']];
const chartDefault = { chart_version:1,title:'科学图表',kind:'bar',x_label:'',y_label:'',series:[{ name:'系列 1',points:[{ x:1,y:0 }] }] } as const;
export const structuredTypes:Record<string,string> = {
  table:'数据表',chart:'科学图表',image:'图片',figure:'插图',source_embed:'来源卡片',
  evidence_reference:'证据引用',artifact_embed:'嵌入文档',knowledge_embed:'知识节点',interactive:'交互清单',
};
export function StructuredEditor({ block,blocks,graph,workspace,save,close }:{
  block:Block; blocks:Block[]; graph?:WorkspaceProjection; workspace:string; save:(value:Block)=>void; close:()=>void;
}) {
  const [attrs,setAttrs] = useState<Record<string,unknown>>(block.attrs ?? {});
  const initialAnnotations=imageAnnotations.safeParse(block.attrs?.annotations);
  const [marks,setMarks] = useState(initialAnnotations.success ? initialAnnotations.data : []);
  const [file,setFile] = useState<File>();
  const [paste,setPaste] = useState('');
  const [rights,setRights] = useState('unknown');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const initialChecklist = checklistAttrs.safeParse(block.attrs);
  const [items,setItems] = useState(initialChecklist.success ? initialChecklist.data.items : [{ text:'',done:false }]);
  const rows = Array.isArray(attrs.rows) && attrs.rows.length ? attrs.rows as string[][] : defaultRows;
  const [chartRows,setChartRows] = useState(() => {
    const parsed = chartAttrs.safeParse(block.attrs);
    if (!parsed.success) return 'X\t系列 1\n1\t0\n2\t1';
    const points = [...new Set(parsed.data.series.flatMap(series => series.points.map(point => point.x)))].sort((a,b) => a-b);
    return [['X',...parsed.data.series.map(series => series.name)],...points.map(x => [String(x),...parsed.data.series.map(series =>
      String(series.points.find(point => point.x === x)?.y ?? ''))])].map(row => row.join('\t')).join('\n');
  });
  const change = (key:string,value:unknown) => setAttrs(previous => ({ ...previous,[key]:value }));
  const list = block.type === 'source_embed' ? graph?.references?.sources ?? [] :
    block.type === 'evidence_reference' ? graph?.references?.evidence ?? [] :
      block.type === 'artifact_embed' ? graph?.references?.artifacts ?? [] : graph?.nodes ?? [];
  const field = block.type === 'source_embed' ? 'source_id' : block.type === 'evidence_reference' ? 'evidence_id' :
    block.type === 'artifact_embed' ? 'artifact_id' : 'node_id';
  const parseRows = (text:string) => text.replace(/\r/g,'').split('\n').filter(line => line.length).map(line => line.split('\t'));
  function setTable(input:string[][]) {
    const width = Math.max(1,...input.map(line => line.length));
    if (!input.length || input.length>250 || width>20 || input.some(line => line.some(cell => cell.length>4000))) {
      setError('表格最多 250 行、20 列，每个单元格最多 4000 个字符。'); return;
    }
    setError('');
    change('rows',input.map(line => Array.from({ length:width },(_,index) => String(line[index] ?? ''))));
  }
  function computeChart() {
    const input = { ...chartDefault,...attrs,chart_version:1,title:String(attrs.title || '科学图表') };
    const parsed = chartAttrs.safeParse(input);
    if (!parsed.success) return;
    const attached = parsed.data.table_id ? blocks.find(item => item.id === parsed.data.table_id) : undefined;
    const matrix = attached?.attrs?.rows ?? parseRows(chartRows);
    const chart = chartFromTable(matrix,parsed.data);
    if (parsed.data.table_id) return parsed.data;
    return chart ? chartAttrs.safeParse(chart).data : undefined;
  }
  async function submit() {
    if (busy) return;
    setError('');
    let next = { ...attrs };
    if (block.type === 'interactive') {
      const checklist = checklistAttrs.safeParse({ ...next,kind:'checklist',items });
      if (!checklist.success) { setError('为每个清单项目填写名称。'); return; }
      next = checklist.data;
    } else if (block.type === 'table') next = { ...next,table_version:1,rows };
    else if (block.type === 'chart') {
      const chart = computeChart();
      if (!chart) { setError('填写至少一组有效数值，或选择文档里的数据表。'); return; }
      next = { ...chart };
    } else if (block.type === 'image' || block.type === 'figure') {
      const annotations=imageAnnotations.safeParse(marks);
      if (!annotations.success) { setError('填写标注名称，横纵位置应在 0 到 100 之间。'); return; }
      next.annotations=annotations.data;
      if (file) {
        if (file.size>2*1024*1024 || !['image/png','image/jpeg'].includes(file.type)) { setError('请选择不超过 2 MiB 的 PNG 或 JPEG。'); return; }
        setBusy(true);
        try {
          const asset = await post<{ id:string }>('/assets',{ workspace_id:workspace,name:file.name.slice(0,190),mime:file.type,
            data_base64:await readFileBase64(file),export_rights:rights });
          next.asset_id=asset.id;
          next.alt=String(next.alt || file.name).slice(0,160);
          delete next.evidence_id;
        } catch (problem) { setError(errorText(problem)); return; }
        finally { setBusy(false); }
      }
      if (!next.asset_id) { setError('请选择图片文件。'); return; }
    } else if (!next[field]) { setError('请选择要引用的对象。'); return; }
    save({ ...block,attrs:next as Block['attrs'] });
  }
  const chart = block.type === 'chart' ? computeChart() : undefined;
  return <form className="block-edit" onSubmit={event => { event.preventDefault(); void submit(); }}>
    {block.type === 'interactive' ? <>
      <label>清单标题<input maxLength={160} value={String(attrs.title ?? '')} onChange={event => change('title',event.target.value)} /></label>
      {items.map((item,index) => <div className="list-item" key={index}>
        <input type="checkbox" aria-label={'完成项目 '+(index+1)} checked={item.done} onChange={event => setItems(items.map((entry,i) => i===index ? { ...entry,done:event.target.checked } : entry))} />
        <input required maxLength={250} aria-label={'清单项目 '+(index+1)} value={item.text} onChange={event => setItems(items.map((entry,i) => i===index ? { ...entry,text:event.target.value } : entry))} />
        <button type="button" disabled={items.length===1} onClick={() => setItems(items.filter((_entry,i) => i!==index))}>移除</button>
      </div>)}
      <div><button type="button" disabled={items.length>=60} onClick={() => setItems([...items,{ text:'',done:false }])}>添加项目</button></div>
    </> : block.type === 'table' ? <>
      <label>表格标题<input value={String(attrs.title ?? '')} maxLength={160} onChange={event => change('title',event.target.value)} /></label>
      <div className="table-wrap"><table><tbody>{rows.map((row,i) => <tr key={i}>{row.map((cell,j) => <td key={j}><input
        aria-label={'表格 ' + (i+1) + ' 行 ' + (j+1) + ' 列'} maxLength={4000} value={String(cell ?? '')}
        onChange={event => change('rows',rows.map((line,r) => r===i ? line.map((value,c) => c===j ? event.target.value : value) : line))} /></td>)}
        {rows.length>1 && <td><button type="button" onClick={() => setTable(rows.filter((_row,index) => index!==i))}>删行</button></td>}</tr>)}</tbody></table></div>
      <div className="button-row">
        <button type="button" disabled={rows.length>=250} onClick={() => setTable([...rows,rows[0]!.map(() => '')])}>添加行</button>
        <button type="button" disabled={rows[0]!.length>=20} onClick={() => setTable(rows.map(row => [...row,'']))}>添加列</button>
        <button type="button" disabled={rows[0]!.length<2} onClick={() => setTable(rows.map(row => row.slice(0,-1)))}>删除末列</button>
      </div>
      <details><summary>粘贴表格数据</summary><label>制表符分隔的数据<textarea value={paste} onChange={event => setPaste(event.target.value)} /></label>
        <button type="button" onClick={() => setTable(parseRows(paste))}>应用粘贴数据</button></details>
    </> : block.type === 'chart' ? <>
      <label>图表标题<input maxLength={160} value={String(attrs.title ?? '')} onChange={event => change('title',event.target.value)} /></label>
      <div className="field-grid"><label>图表类型<select value={String(attrs.kind ?? 'bar')} onChange={event => change('kind',event.target.value)}>
        <option value="bar">柱状图</option><option value="line">折线图</option><option value="scatter">散点图</option></select></label>
        <label>横轴标题<input maxLength={160} value={String(attrs.x_label ?? '')} onChange={event => change('x_label',event.target.value)} /></label>
        <label>纵轴标题和单位<input maxLength={160} value={String(attrs.y_label ?? '')} onChange={event => change('y_label',event.target.value)} /></label></div>
      <label>关联数据表<select value={String(attrs.table_id ?? '')} onChange={event => {
        const value = event.target.value;
        if (value) change('table_id',value);
        else setAttrs(previous => { const next={...previous}; delete next.table_id; return next; });
      }}><option value="">手动填写数据</option>{blocks.filter(item => item.type === 'table').map((item,index) =>
        <option key={item.id} value={item.id}>{String(item.attrs?.title || '数据表 ' + (index+1))}</option>)}</select></label>
      {!attrs.table_id && <label>数值表（制表符分列，首行为表头）<textarea value={chartRows} onChange={event => setChartRows(event.target.value)} /></label>}
      {chart && <ChartBlock block={{ ...block,attrs:chart }} blocks={blocks} />}
    </> : block.type === 'image' || block.type === 'figure' ? <>
      <label>图片文件<input type="file" accept="image/png,image/jpeg" onChange={event => { setFile(event.target.files?.[0]); if (event.target.files?.length) setMarks([]); }} /></label>
      <details><summary>图片标注</summary><div className="stack">
        {typeof attrs.asset_id === 'string' && !file && <AnalysisImage block={{ ...block,attrs:{ ...attrs,annotations:marks } as Block['attrs'] }}
          onMark={(x,y) => { if (marks.length<24) setMarks([...marks,{ x,y,label:'标注 '+(marks.length+1) }]); }} />}
        {marks.map((mark,index) => <div key={index} className="field-grid">
          <label>标注 {index+1}<input required maxLength={160} value={mark.label} onChange={event => setMarks(marks.map((item,i) => i===index ? { ...item,label:event.target.value } : item))} /></label>
          {(['x','y'] as const).map(axis => <label key={axis}>{axis === 'x' ? '横向 %' : '纵向 %'}<input required type="number" min={0} max={100} value={mark[axis]}
            onChange={event => setMarks(marks.map((item,i) => i===index ? { ...item,[axis]:Number(event.target.value) } : item))} /></label>)}
          <button type="button" onClick={() => setMarks(marks.filter((_item,i) => i!==index))}>移除标注</button>
        </div>)}
        <div><button type="button" disabled={marks.length>=24} onClick={() => setMarks([...marks,{ x:50,y:50,label:'标注 '+(marks.length+1) }])}>添加标注</button></div>
      </div></details>
      {file && <label>使用权利<select value={rights} onChange={event => setRights(event.target.value)}>
        <option value="unknown">尚未指定</option><option value="user_owned">本人拥有</option><option value="public_license">公开许可</option><option value="restricted">限制再分发</option>
      </select></label>}
      <label>替代文字<input maxLength={160} value={String(attrs.alt ?? '')} onChange={event => change('alt',event.target.value)} /></label>
      <label>图注<textarea maxLength={2000} value={String(attrs.caption ?? '')} onChange={event => change('caption',event.target.value)} /></label>
      <div className="field-grid">
        <label>展示宽度<select value={String(attrs.width ?? 'full')} onChange={event => change('width',event.target.value)}>
          <option value="small">小</option><option value="medium">中</option><option value="full">全宽</option></select></label>
        <label>展示裁切<select value={String(attrs.fit ?? 'contain')} onChange={event => change('fit',event.target.value)}>
          <option value="contain">完整显示</option><option value="cover">裁成 16:9</option></select></label>
        {attrs.fit === 'cover' && <label>裁切位置<select value={String(attrs.position ?? 'center')} onChange={event => change('position',event.target.value)}>
          <option value="center">中间</option><option value="top">上方</option><option value="bottom">下方</option></select></label>}
      </div>
    </> : <>
      <label>{structuredTypes[block.type]}<select value={String(attrs[field] ?? '')} onChange={event => change(field,event.target.value)}>
        <option value="">选择要引用的对象</option>{list.map(item => <option key={item.id} value={item.id}>
          {item.title}{'quote' in item && ' · ' + String(item.quote).slice(0,54)}</option>)}</select></label>
      {block.type !== 'evidence_reference' && <label>显示标题<input maxLength={160} value={String(attrs.title ?? '')}
        onChange={event => change('title',event.target.value)} /></label>}
    </>}
    {error && <p role="alert">{error}</p>}
    <div className="button-row"><button className="primary" disabled={busy}>保存内容块</button><button type="button" onClick={close}>取消</button></div>
  </form>;
}
