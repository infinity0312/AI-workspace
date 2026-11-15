import { useEffect, useState } from 'react';
import { imageAnnotations,type Block } from '@akw/contracts';
import { api } from '../lib/api';

export function AnalysisImage({ block,onEvidence,onMark }:{ block:Block; onEvidence?:(id:string)=>void; onMark?:(x:number,y:number)=>void }) {
  const [preview,setPreview] = useState<{ id:string;url?:string }>();
  const asset = typeof block.attrs?.asset_id === 'string' ? block.attrs.asset_id : undefined;
  const title = String(block.attrs?.alt ?? '相关图片');
  const evidence = block.attrs?.evidence_id;
  const annotations = imageAnnotations.safeParse(block.attrs?.annotations);
  const marks = annotations.success ? annotations.data : [];
  const url = preview?.id === asset ? preview?.url : undefined;
  const caption = [block.attrs?.credit,block.attrs?.license].filter(Boolean).join(' · ');
  useEffect(() => {
    if (!asset) return;
    const stop = new AbortController();
    void api<{ mime:string; data_base64:string }>('/assets/' + asset + '/preview',{ signal:stop.signal }).then(value => {
      if (!stop.signal.aborted && ['image/jpeg','image/png'].includes(value.mime)) setPreview({ id:asset,url:'data:' + value.mime + ';base64,' + value.data_base64 });
    }).catch(() => { if (!stop.signal.aborted) setPreview({ id:asset }); });
    return () => stop.abort();
  },[asset]);
  return <figure className="analysis-image" data-fit={block.attrs?.fit === 'cover' ? 'cover' : 'contain'}
    data-width={String(block.attrs?.width ?? 'full')} data-position={String(block.attrs?.position ?? 'center')}>
    {url ? <div className="image-with-marks" data-markable={Boolean(onMark)}>
      <img src={url} alt={title} loading="lazy" onClick={event => {
        if (!onMark) return;
        const box=event.currentTarget.getBoundingClientRect();
        if (box.width && box.height) onMark(Math.round(100*(event.clientX-box.left)/box.width),Math.round(100*(event.clientY-box.top)/box.height));
      }} />
      {marks.map((mark,index) => <span className="image-mark" key={index} style={{ left:mark.x+'%',top:mark.y+'%' }} title={mark.label}>{index+1}</span>)}
    </div> : asset && <p className="muted">{preview?.id === asset ? '图片暂时无法打开。' : '正在加载图片…'}</p>}
    <figcaption><strong>{title}</strong>{caption && <span>{caption}</span>}
      {typeof block.attrs?.caption === 'string' && <span className="image-caption">{block.attrs.caption}</span>}
      {marks.length > 0 && <ol className="image-notes">{marks.map((mark,index) => <li key={index}>{mark.label}</li>)}</ol>}
      {typeof evidence === 'string' && onEvidence && <button className="citation" type="button" onClick={() => onEvidence(evidence)}>图片来源</button>}
    </figcaption>
  </figure>;
}
