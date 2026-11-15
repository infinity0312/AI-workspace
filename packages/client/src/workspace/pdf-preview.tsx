import { useEffect,useRef,useState } from 'react';
import type { PDFDocumentLoadingTask,PDFDocumentProxy,RenderTask } from 'pdfjs-dist';
import { api,errorText } from '../lib/api';

export function PdfPreview({ asset,firstPage }:{ asset:string;firstPage?:number|null }) {
  const [pdf,setPdf] = useState<PDFDocumentProxy>();
  const [page,setPage] = useState(firstPage || 1);
  const [zoom,setZoom] = useState(100);
  const [error,setError] = useState('');
  const [renderedPage,setRenderedPage] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    let task:PDFDocumentLoadingTask|undefined;
    void (async () => {
      const { data_base64 } = await api<{ data_base64:string }>('/assets/'+asset+'/pdf-preview',{ signal:controller.signal });
      const library = await import('pdfjs-dist');
      // This module registers the local worker handler in bundled WebView and browser builds.
      // @ts-expect-error PDF.js does not declare types for its worker module.
      await import('pdfjs-dist/build/pdf.worker.min.mjs');
      if (controller.signal.aborted) return;
      const bytes = Uint8Array.from(atob(data_base64),character => character.charCodeAt(0));
      task = library.getDocument({ data:bytes,isEvalSupported:false,enableXfa:false,disableFontFace:false,
        useWasm:false,useSystemFonts:true,maxImageSize:12_000_000 });
      const document = await task.promise;
      if (!controller.signal.aborted) {
        setPage(number => Math.min(document.numPages,Math.max(1,number)));
        setPdf(document);
      }
    })().catch(problem => { if (!controller.signal.aborted) setError(errorText(problem)); });
    return () => { controller.abort(); void task?.destroy().catch(() => undefined); };
  },[asset]);
  useEffect(() => {
    if (!pdf) return;
    let task:RenderTask|undefined;
    let cancelled = false;
    void (async () => {
      const target = canvas.current;
      if (!target) return;
      const original = await pdf.getPage(page);
      if (cancelled) return;
      const base = original.getViewport({ scale:1 });
      const desired = Math.min(2,Math.max(0.3,720/base.width*zoom/100),2200/base.height);
      const viewport = original.getViewport({ scale:desired });
      target.width = Math.ceil(viewport.width);
      target.height = Math.ceil(viewport.height);
      task = original.render({ canvas:target,viewport,annotationMode:0 });
      await task.promise;
      if (!cancelled) setRenderedPage(page);
    })().catch(problem => { if (!cancelled) setError(errorText(problem)); });
    return () => { cancelled=true; task?.cancel(); };
  },[pdf,page,zoom]);
  if (error) return <p role="alert">PDF 阅读失败 · {error}</p>;
  return <div className="pdf-preview stack">
    {!pdf ? <p role="status">正在打开 PDF…</p> : <div className="button-row">
      <button disabled={page <= 1} onClick={() => setPage(page-1)}>上一页</button>
      <button disabled={page >= pdf.numPages} onClick={() => setPage(page+1)}>下一页</button>
      <span>第 {page} / {pdf.numPages} 页</span>
      <label>缩放<select value={zoom} onChange={event => setZoom(Number(event.target.value))}>
        {[75,100,125,150,200].map(value => <option key={value} value={value}>{value}%</option>)}
      </select></label>
    </div>}
    <div className="pdf-page"><canvas ref={canvas} hidden={!renderedPage} aria-label={'PDF 第 '+renderedPage+' 页'}
      style={{ width:zoom+'%' }} /></div>
  </div>;
}
