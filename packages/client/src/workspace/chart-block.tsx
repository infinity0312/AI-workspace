import {AtlasArt} from './atlas-art';
import {useEffect,useMemo,useState} from 'react';
import {buildChartScene,chartAttrs,chartFromTable,chartPalette,type Block} from '@akw/contracts';
import {EntityInspector,InspectorAction} from './entity-inspector';
import {ResultSummary} from './explorer-controls';
export function ChartBlock({block,blocks=[],onEvidence}:{block:Block;blocks?:Block[];onEvidence?:(id:string)=>void}){
  const [hidden,setHidden]=useState<number[]>([]),[selected,setSelected]=useState<{series:string;x:number;y:number;label?:string}|null>(null);
  const chart=useMemo(()=>{const decoded=chartAttrs.safeParse(block.attrs);if(!decoded.success)return;const model=decoded.data;if(!model.table_id)return model;return chartFromTable(blocks.find(item=>item.id===model.table_id&&item.type==='table')?.attrs?.rows,model);},[block,blocks]);
  const signature=chart?JSON.stringify(chart):'';
  useEffect(()=>{setHidden([]);setSelected(null);},[signature]);
  if(!chart)return <p className="muted">图表暂无可绘制的结构化数值。原始内容保留；需要 x / y / series 数据。</p>;
  const allEntries=chart.series.map((item,index)=>({item,index}));
  const requested=allEntries.filter(entry=>!hidden.includes(entry.index));
  const entries=requested.length?requested:allEntries;
  const series=entries.map(entry=>entry.item);
  const scene=buildChartScene({...chart,series});
  const points=series.flatMap(item=>[...item.points].sort((a,b)=>a.x-b.x).map(point=>({...point,series:item.name})));
  let pointIndex=0;
  const color=(value:string)=>chartPalette.includes(value)?`var(--chart-${entries[chartPalette.indexOf(value)]!.index+1})`:value==='#d8ddea'?'var(--line)':'var(--muted)';
  const activate=(index:number)=>()=>setSelected(points[index]||null);
  return <section className="chart-block stack scientific-chart" aria-label={chart.title}><header className="atlas-scientific-heading"><div><p className="eyebrow">SCIENTIFIC / {chart.kind.toUpperCase()}</p><h3>{chart.title}</h3></div><figure><AtlasArt asset="aa_scientific_mica_01"/><figcaption>概念插画</figcaption></figure></header><ResultSummary>{series.length} 个可见系列 · {points.length} 个原始数据点</ResultSummary><div className="scientific-plot" role="region" aria-label="科学数据图，可点选数据点或使用下方数据表" tabIndex={0}><svg viewBox="0 0 800 460" aria-label={chart.title} role="group">{scene.marks.map((mark,index)=>{
    if(mark.kind==='line')return <polyline key={index} points={mark.points.map(point=>point.x+','+point.y).join(' ')} fill="none" stroke={color(mark.color)} strokeWidth={mark.width}/>;
    const datum=(mark.kind==='dot'||mark.kind==='rect'&&mark.y<=354)?pointIndex++:-1;
    const point=points[datum];
    const props=point?{tabIndex:0,role:'button',className:'chart-datum','aria-label':point.series+'：'+(point.label||point.x)+'，'+point.y,onClick:activate(datum),onKeyDown:(event:React.KeyboardEvent)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activate(datum)();}}}:{};
    return mark.kind==='dot'?<circle key={index} cx={mark.x} cy={mark.y} r={5} fill={color(mark.color)} {...props}/>:<rect key={index} x={mark.x} y={mark.y} width={mark.width} height={Math.max(mark.height,point?2:mark.height)} fill={color(mark.color)} {...props}/>;
  })}{scene.labels.map((label,index)=><text key={index} x={label.x} y={label.y} fontSize={label.size||13} textAnchor={label.align==='center'?'middle':label.align==='right'?'end':'start'} fill="var(--ink)">{label.text}</text>)}</svg></div>
    <div className="button-row" role="group" aria-label="图表系列">{chart.series.map((item,index)=><button key={index} className="series-toggle" aria-pressed={!hidden.includes(index)} onClick={()=>setHidden(previous=>previous.includes(index)?previous.filter(value=>value!==index):previous.length+1<chart.series.length?[...previous,index]:previous)}><span style={{background:`var(--chart-${index+1})`}}/>{item.name}{hidden.includes(index)?' · 已隐藏':''}</button>)}</div>
    <p className="projection-caption">{!chart.x_label||!chart.y_label?'轴变量或单位尚未完整标注。 ':''}保留原始数值，无平滑或异常值剔除。未提供误差、测量/预测分类和方法，不能据此推定。</p>
    <details><summary>查看图表数据</summary><div className="table-wrap"><table><caption>{chart.title} · 原始数据</caption><thead><tr><th scope="col">系列</th><th scope="col">{chart.x_label||'横轴（单位未提供）'}</th><th scope="col">{chart.y_label||'数值（单位未提供）'}</th><th scope="col">详情</th></tr></thead><tbody>{chart.series.flatMap((item,i)=>item.points.map((point,j)=><tr key={i+':'+j}><th scope="row">{item.name}</th><td>{point.label||point.x}</td><td>{point.y}</td><td><button onClick={()=>setSelected({...point,series:item.name})}>查看数据点 {i+1}.{j+1}</button></td></tr>))}</tbody></table></div></details>
    {selected&&<EntityInspector title={selected.series+' / '+(selected.label||selected.x)} kind="数据点" onClose={()=>setSelected(null)}><dl><dt>{chart.x_label||'x / 单位未提供'}</dt><dd>{selected.x}</dd><dt>{chart.y_label||'y / 单位未提供'}</dt><dd>{selected.y}</dd><dt>系列</dt><dd>{selected.series}</dd></dl>{onEvidence&&block.children?.filter(node=>node.type==='citation'&&typeof node.attrs?.evidence_id==='string').map((node,index)=><InspectorAction key={index} onClick={()=>onEvidence(String(node.attrs!.evidence_id))}>本图来源引用 {index+1}</InspectorAction>)}<p>来源引用见本图邻接引用；未提供此数据点的独立证据定位或误差。</p></EntityInspector>}
  </section>;
}
