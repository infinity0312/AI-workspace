import {AtlasArt,legacyArt} from './atlas-art';
import { useState } from 'react';
import { editorialAssets } from '../assets/asset-registry';

export function EditorialImage({ asset,className='',priority=false,alt='' }:{asset:string;className?:string;priority?:boolean;alt?:string}) {
  const [failed,setFailed]=useState(false);
  const item=editorialAssets[asset],mobile=editorialAssets[asset.replace(/-desktop$/,'')+'-mobile'];
  const modular=legacyArt[asset];
  if(modular)return <AtlasArt key={asset} asset={modular} className={className} priority={priority} alt={alt}/>;
  return <picture className={'editorial-image '+className} data-asset={asset} data-failed={failed || !item || undefined}>
    {!failed && item && <>{mobile && <source media="(max-width:680px)" srcSet={mobile.srcSet} sizes="(max-width:440px) 92vw, 480px" width={mobile.width} height={mobile.height} />}<img src={item.src} srcSet={item.srcSet} sizes="(max-width:680px) 92vw, (max-width:1100px) 60vw, 680px" width={item.width} height={item.height} alt={alt} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" onError={()=>setFailed(true)} /></>}
    {(failed || !item) && <span className="editorial-fallback" aria-hidden="true">a.</span>}
  </picture>;
}

export function EditorialEmpty({asset,title,children}:{asset:string;title:string;children?:React.ReactNode}) {
  return <section className="editorial-empty-state"><EditorialImage asset={asset} /><div><h3>{title}</h3>{children}</div></section>;
}
