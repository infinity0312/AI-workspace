import {useState,type ReactNode} from 'react';
import {atlasArtAssets} from '../assets/art-direction/v3.1/registry';

/** Decorative conceptual objects; never a research source or a data visualization. */
export function AtlasArt({asset,className='',priority=false,alt=''}:{asset:string;className?:string;priority?:boolean;alt?:string}){
 const [failed,setFailed]=useState(''),item=atlasArtAssets[asset];
 if(!item||failed===asset)return <span className={'atlas-art atlas-art-unavailable '+className} data-art-asset={asset} data-art-failed="true" data-art-src={item?.src} aria-hidden="true"/>;
 return <picture className={'atlas-art '+className} data-art-asset={asset}>
  <img src={item.src} srcSet={item.srcSet} sizes="(max-width:680px) 120px, 220px" width={item.width} height={item.height} alt={alt} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'} decoding="async" onError={()=>setFailed(asset)}/>
 </picture>;
}
export function AtlasHeading({code,title,description,asset,children}:{code:string;title:string;description?:string;asset?:string;children?:ReactNode}){
 return <header className="atlas-view-heading"><div><p className="eyebrow">{code}</p><h3>{title}</h3>{description&&<p className="atlas-view-description">{description}</p>}{children}</div>{asset&&<figure><AtlasArt asset={asset}/><figcaption>概念插画</figcaption></figure>}</header>;
}
export const legacyArt:Record<string,string>={
 'collection-empty':'aa_document_notebook_01','collection-empty-mobile':'aa_document_notebook_01',
 'comparison-empty':'aa_graph_mineral_01','comparison-empty-mobile':'aa_graph_mineral_01',
 'error-recovery':'aa_dependency_instrument_01','error-recovery-mobile':'aa_dependency_instrument_01',
 'evidence-empty':'aa_evidence_manuscript_01','evidence-empty-mobile':'aa_evidence_manuscript_01',
 'mindmap-empty':'aa_mindmap_branching_01','mindmap-empty-mobile':'aa_mindmap_branching_01',
 'timeline-empty':'aa_timeline_astronomical_01','timeline-empty-mobile':'aa_timeline_astronomical_01',
 'learning-empty':'aa_learning_seed_capsule_01','learning-empty-mobile':'aa_learning_seed_capsule_01',
 'learning-folio':'aa_learning_botanical_01','guide-manual':'aa_document_notebook_01',
 'offline-preserved':'aa_document_notebook_01','offline-preserved-mobile':'aa_document_notebook_01',
 'search-empty':'aa_home_compass_01','search-empty-mobile':'aa_home_compass_01','research-process':'aa_dependency_instrument_01',
 'timeline-illustration':'aa_timeline_astronomical_01',
};
