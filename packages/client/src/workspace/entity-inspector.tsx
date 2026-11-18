import {createContext,useContext,useEffect,useRef,useState,type ButtonHTMLAttributes,type ReactNode} from 'react';
const InspectorNavigation=createContext<(action:()=>void)=>void>(action=>action());
export function InspectorAction({onClick,...props}:Omit<ButtonHTMLAttributes<HTMLButtonElement>,'onClick'>&{onClick:()=>void}){
  const navigate=useContext(InspectorNavigation);
  return <button {...props} onClick={()=>navigate(onClick)}/>;
}
export function EntityInspector({title,kind,onClose,children}:{title:string;kind:string;onClose:()=>void;children:ReactNode}) {
  const ref=useRef<HTMLDialogElement>(null);
  const restoreFocus=useRef(true);
  const [overlay,setOverlay]=useState(false);
  useEffect(()=>{
    const element=ref.current,previous=document.activeElement as HTMLElement|null;
    const media=window.matchMedia('(max-width:1199px)');
    let last:boolean|undefined;
    function open(){const narrow=media.matches||(element?.parentElement?.clientWidth||1200)<820;if(narrow===last&&element?.open)return;last=narrow;setOverlay(narrow);element?.close();if(narrow)element?.showModal();else element?.show();}
    const observer=new ResizeObserver(open);if(element?.parentElement)observer.observe(element.parentElement);
    open();media.addEventListener('change',open);
    return()=>{observer.disconnect();media.removeEventListener('change',open);element?.close();if(restoreFocus.current&&previous?.isConnected)previous.focus({preventScroll:true});};
  },[]);
  return <dialog ref={ref} className={'entity-inspector'+(overlay?' is-overlay':'')} aria-label={kind+'详情：'+title} onCancel={event=>{event.preventDefault();onClose();}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();onClose();}}}><div className="popover-header"><span className="eyebrow">{kind} / INSPECTOR</span><button aria-label="关闭对象详情" onClick={onClose}>×</button></div><h3>{title}</h3><InspectorNavigation.Provider value={action=>{restoreFocus.current=false;ref.current?.close();onClose();window.requestAnimationFrame(action);}}><div className="stack inspector-details">{children}</div></InspectorNavigation.Provider></dialog>;
}
