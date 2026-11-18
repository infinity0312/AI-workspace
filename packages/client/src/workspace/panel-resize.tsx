export function PanelResize({ side,width,onChange }:{ side:'left'|'right';width:number;onChange:(width:number)=>void }) {
  const min=side==='left' ? 180 : 250,max=side==='left' ? 340 : 500;
  const change=(value:number)=>onChange(Math.round(Math.max(min,Math.min(max,value))));
  return <div className={'panel-resize panel-resize-'+side} role="separator" tabIndex={0} aria-label={side==='left' ? '调整导航宽度' : '调整检查器宽度'} aria-orientation="vertical" aria-valuemin={min} aria-valuemax={max} aria-valuenow={width}
    onPointerDown={event=>{ event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId); }}
    onPointerMove={event=>{ if(!event.currentTarget.hasPointerCapture(event.pointerId)) return;const bounds=event.currentTarget.parentElement!.getBoundingClientRect();change(side==='left' ? event.clientX-bounds.left : bounds.right-event.clientX); }}
    onPointerUp={event=>{ if(event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
    onKeyDown={event=>{ if(event.key==='ArrowLeft' || event.key==='ArrowRight') { event.preventDefault();change(width+(event.key==='ArrowRight' ? 12 : -12)*(side==='left' ? 1 : -1)); } }} />;
}
