import { useEffect, useMemo, useRef, useState } from 'react';
import { buildChartScene, chartAttrs, chartFromTable, type Block } from '@akw/contracts';

export function ChartBlock({ block,blocks = [] }:{ block:Block; blocks?:Block[] }) {
  const [hidden,setHidden] = useState<string[]>([]);
  const ref = useRef<HTMLCanvasElement>(null);
  const decoded = chartAttrs.safeParse(block.attrs);
  const chart = useMemo(() => {
    if (!decoded.success) return;
    const model = decoded.data;
    if (!model.table_id) return model;
    const table = blocks.find(item => item.type === 'table' && item.id === model.table_id);
    return chartFromTable(table?.attrs?.rows,model);
  },[decoded,blocks]);
  useEffect(() => {
    if (!chart || !ref.current) return;
    const ctx = ref.current.getContext('2d');
    if (!ctx) return;
    const series = chart.series.filter(item => !hidden.includes(item.name));
    const data = buildChartScene({ ...chart,series:series.length ? series : chart.series });
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,data.width,data.height);
    for (const mark of data.marks) {
      ctx.strokeStyle=mark.color; ctx.fillStyle=mark.color;
      if (mark.kind === 'rect') ctx.fillRect(mark.x,mark.y,mark.width,mark.height);
      else if (mark.kind === 'dot') { ctx.beginPath(); ctx.arc(mark.x,mark.y,mark.r,0,2*Math.PI); ctx.fill(); }
      else {
        ctx.beginPath(); ctx.lineWidth=mark.width;
        mark.points.forEach((point,index) => index ? ctx.lineTo(point.x,point.y) : ctx.moveTo(point.x,point.y));
        ctx.stroke();
      }
    }
    for (const label of data.labels) {
      ctx.fillStyle=label.color ?? '#242a3a'; ctx.textAlign=label.align ?? 'left'; ctx.font=(label.size ?? 13)+'px system-ui';
      ctx.fillText(label.text,label.x,label.y);
    }
  },[chart,hidden]);
  if (!chart) return <p className="muted">图表暂无可绘制的数值。表格第一列填写横轴，后续列填写数值。</p>;
  return <section className="chart-block stack" aria-label={chart.title}>
    <canvas ref={ref} width={800} height={460} role="img" aria-label={chart.title} />
    {chart.series.length > 1 && <div className="button-row">{chart.series.map(series => <button key={series.name}
      aria-pressed={!hidden.includes(series.name)} onClick={() => setHidden(previous => {
        if (previous.includes(series.name)) return previous.filter(name => name !== series.name);
        return previous.length + 1 < chart.series.length ? [...previous,series.name] : previous;
      })}>{series.name}</button>)}</div>}
    <details><summary>查看图表数据</summary><div className="table-wrap"><table>
      <thead><tr><th>系列</th><th>{chart.x_label || '横轴'}</th><th>{chart.y_label || '数值'}</th></tr></thead>
      <tbody>{chart.series.flatMap((series,i) => series.points.map((point,j) => <tr key={i+':'+j}>
        <td>{series.name}</td><td>{point.label || point.x}</td><td>{point.y}</td>
      </tr>))}</tbody>
    </table></div></details>
  </section>;
}
