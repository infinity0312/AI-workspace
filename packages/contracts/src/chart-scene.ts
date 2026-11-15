import type { ChartAttrs } from './workspace-blocks';

type Text = { x:number;y:number;text:string;size?:number;align?:'left'|'center'|'right';color?:string };
type Mark =
  | { kind:'line';points:{ x:number;y:number }[];color:string;width:number }
  | { kind:'rect';x:number;y:number;width:number;height:number;color:string }
  | { kind:'dot';x:number;y:number;r:number;color:string };
export type ChartScene = { width:number;height:number;title:string;marks:Mark[];labels:Text[] };
export const chartPalette = ['#394ac7','#177866','#b95030','#803a9d','#8c6d0a','#1665a3'];

export function buildChartScene(chart:ChartAttrs):ChartScene {
  const width = 800, height = 460;
  const left = 86, right = 760, top = 62, bottom = 354;
  const values = chart.series.flatMap(series => series.points);
  const distinct = [...new Set(values.map(point => point.x))].sort((a,b) => a-b);
  const xMin = distinct[0] ?? 0, xMax = distinct.at(-1) ?? 1;
  const yValues = values.map(point => point.y);
  const rawLow = Math.min(...yValues),rawHigh = Math.max(...yValues);
  const yLow = chart.kind === 'bar' ? Math.min(0,rawLow) : rawLow;
  const yHigh = chart.kind === 'bar' ? Math.max(0,rawHigh) : rawHigh;
  const yMin = yLow === yHigh ? yLow-1 : yLow;
  const yMax = yLow === yHigh ? yHigh+1 : yHigh;
  const band = (right-left)/Math.max(1,distinct.length);
  const categories = new Map(distinct.map((value,index) => [value,left+band*(index+0.5)]));
  const categoryLabels = new Map(values.filter(point => point.label).map(point => [point.x,point.label]));
  const px = (value:number) => chart.kind === 'bar' ? categories.get(value)! :
    xMin === xMax ? (left+right)/2 : left + (right-left)*(value-xMin)/(xMax-xMin);
  const py = (value:number) => bottom-(bottom-top)*(value-yMin)/(yMax-yMin);
  const marks:Mark[] = [];
  const labels:Text[] = [{ x:width/2,y:31,text:chart.title,size:18,align:'center' },
    { x:width/2,y:402,text:chart.x_label,size:13,align:'center' },
    { x:left,y:50,text:chart.y_label,size:13 }];
  const format = (value:number) => Number(value.toPrecision(5)).toString();
  for (let i=0;i<=4;i++) {
    const value = yMin+(yMax-yMin)*i/4, y = py(value);
    marks.push({ kind:'line',points:[{ x:left,y },{ x:right,y }],color:'#d8ddea',width:1 });
    labels.push({ x:left-9,y:y+4,text:format(value),align:'right',size:12 });
  }
  const step = Math.max(1,Math.ceil(distinct.length/9));
  distinct.forEach((value,index) => {
    if (index % step) return;
    const x = px(value), label = categoryLabels.get(value) ?? format(value);
    labels.push({ x,y:bottom+20,text:label.slice(0,12),align:'center',size:12 });
  });
  marks.push({ kind:'line',points:[{ x:left,y:top },{ x:left,y:bottom },{ x:right,y:bottom }],color:'#4a5368',width:1.3 });
  chart.series.forEach((series,index) => {
    const color = chartPalette[index % chartPalette.length]!;
    const points = [...series.points].sort((a,b) => a.x-b.x);
    if (chart.kind === 'line' && points.length>1) marks.push({ kind:'line',points:points.map(point => ({ x:px(point.x),y:py(point.y) })),color,width:2.4 });
    for (const point of points) {
      const x = px(point.x),y = py(point.y);
      if (chart.kind === 'bar') {
        const bar = Math.max(0.5,band*0.76/chart.series.length);
        const baseline = py(0);
        marks.push({ kind:'rect',x:x+bar*(index-chart.series.length/2),y:Math.min(y,baseline),width:bar*0.91,height:Math.abs(baseline-y),color });
      } else marks.push({ kind:'dot',x,y,r:3.5,color });
    }
    const x = left + (index % 3) * 222, y = 421 + Math.floor(index/3) * 17;
    marks.push({ kind:'rect',x,y:y-7,width:11,height:8,color });
    labels.push({ x:x+17,y,text:series.name.slice(0,22),size:11 });
  });
  return { width,height,title:chart.title,marks,labels };
}
