import a0v192 from './optimized/aa_learning_botanical_01-192.webp';
import a0v384 from './optimized/aa_learning_botanical_01-384.webp';
import a0v768 from './optimized/aa_learning_botanical_01-768.webp';
import a1v192 from './optimized/aa_graph_mineral_01-192.webp';
import a1v384 from './optimized/aa_graph_mineral_01-384.webp';
import a1v768 from './optimized/aa_graph_mineral_01-768.webp';
import a2v192 from './optimized/aa_home_compass_01-192.webp';
import a2v384 from './optimized/aa_home_compass_01-384.webp';
import a2v768 from './optimized/aa_home_compass_01-768.webp';
import a3v192 from './optimized/aa_dependency_instrument_01-192.webp';
import a3v384 from './optimized/aa_dependency_instrument_01-384.webp';
import a3v768 from './optimized/aa_dependency_instrument_01-768.webp';
import a4v192 from './optimized/aa_document_notebook_01-192.webp';
import a4v384 from './optimized/aa_document_notebook_01-384.webp';
import a4v768 from './optimized/aa_document_notebook_01-768.webp';
import a5v192 from './optimized/aa_evidence_archive_stamp_01-192.webp';
import a5v384 from './optimized/aa_evidence_archive_stamp_01-384.webp';
import a5v768 from './optimized/aa_evidence_archive_stamp_01-768.webp';
import a6v192 from './optimized/aa_evidence_manuscript_01-192.webp';
import a6v384 from './optimized/aa_evidence_manuscript_01-384.webp';
import a6v768 from './optimized/aa_evidence_manuscript_01-768.webp';
import a7v192 from './optimized/aa_global_cartographic_ornament_01-192.webp';
import a7v384 from './optimized/aa_global_cartographic_ornament_01-384.webp';
import a7v768 from './optimized/aa_global_cartographic_ornament_01-768.webp';
import a8v192 from './optimized/aa_global_ink_texture_01-192.webp';
import a8v384 from './optimized/aa_global_ink_texture_01-384.webp';
import a8v768 from './optimized/aa_global_ink_texture_01-768.webp';
import a9v192 from './optimized/aa_global_paper_grain_01-192.webp';
import a9v384 from './optimized/aa_global_paper_grain_01-384.webp';
import a9v768 from './optimized/aa_global_paper_grain_01-768.webp';
import a10v192 from './optimized/aa_graph_contour_01-192.webp';
import a10v384 from './optimized/aa_graph_contour_01-384.webp';
import a10v768 from './optimized/aa_graph_contour_01-768.webp';
import a11v192 from './optimized/aa_graph_mountain_01-192.webp';
import a11v384 from './optimized/aa_graph_mountain_01-384.webp';
import a11v768 from './optimized/aa_graph_mountain_01-768.webp';
import a12v192 from './optimized/aa_home_atlas_fragment_01-192.webp';
import a12v384 from './optimized/aa_home_atlas_fragment_01-384.webp';
import a12v768 from './optimized/aa_home_atlas_fragment_01-768.webp';
import a13v192 from './optimized/aa_learning_fossil_01-192.webp';
import a13v384 from './optimized/aa_learning_fossil_01-384.webp';
import a13v768 from './optimized/aa_learning_fossil_01-768.webp';
import a14v192 from './optimized/aa_learning_seed_capsule_01-192.webp';
import a14v384 from './optimized/aa_learning_seed_capsule_01-384.webp';
import a14v768 from './optimized/aa_learning_seed_capsule_01-768.webp';
import a15v192 from './optimized/aa_mindmap_branching_01-192.webp';
import a15v384 from './optimized/aa_mindmap_branching_01-384.webp';
import a15v768 from './optimized/aa_mindmap_branching_01-768.webp';
import a16v192 from './optimized/aa_scientific_mica_01-192.webp';
import a16v384 from './optimized/aa_scientific_mica_01-384.webp';
import a16v768 from './optimized/aa_scientific_mica_01-768.webp';
import a17v192 from './optimized/aa_sources_book_spine_01-192.webp';
import a17v384 from './optimized/aa_sources_book_spine_01-384.webp';
import a17v768 from './optimized/aa_sources_book_spine_01-768.webp';
import a18v192 from './optimized/aa_timeline_astronomical_01-192.webp';
import a18v384 from './optimized/aa_timeline_astronomical_01-384.webp';
import a18v768 from './optimized/aa_timeline_astronomical_01-768.webp';
import a19v192 from './optimized/aa_timeline_strata_01-192.webp';
import a19v384 from './optimized/aa_timeline_strata_01-384.webp';
import a19v768 from './optimized/aa_timeline_strata_01-768.webp';
const url=(image:string|{src:string})=>typeof image==='string'?image:image.src;
export const atlasArtAssets:Record<string,{src:string;srcSet:string;width:number;height:number}>={
"aa_learning_botanical_01":{src:url(a0v384),srcSet:[url(a0v192)+' 192w',url(a0v384)+' 384w',url(a0v768)+' 768w'].join(', '),width:384,height:384},
"aa_graph_mineral_01":{src:url(a1v384),srcSet:[url(a1v192)+' 192w',url(a1v384)+' 384w',url(a1v768)+' 768w'].join(', '),width:384,height:384},
"aa_home_compass_01":{src:url(a2v384),srcSet:[url(a2v192)+' 192w',url(a2v384)+' 384w',url(a2v768)+' 768w'].join(', '),width:384,height:384},
"aa_dependency_instrument_01":{src:url(a3v384),srcSet:[url(a3v192)+' 192w',url(a3v384)+' 384w',url(a3v768)+' 768w'].join(', '),width:384,height:144},
"aa_document_notebook_01":{src:url(a4v384),srcSet:[url(a4v192)+' 192w',url(a4v384)+' 384w',url(a4v768)+' 768w'].join(', '),width:384,height:256},
"aa_evidence_archive_stamp_01":{src:url(a5v384),srcSet:[url(a5v192)+' 192w',url(a5v384)+' 384w',url(a5v768)+' 768w'].join(', '),width:384,height:256},
"aa_evidence_manuscript_01":{src:url(a6v384),srcSet:[url(a6v192)+' 192w',url(a6v384)+' 384w',url(a6v768)+' 768w'].join(', '),width:384,height:256},
"aa_global_cartographic_ornament_01":{src:url(a7v384),srcSet:[url(a7v192)+' 192w',url(a7v384)+' 384w',url(a7v768)+' 768w'].join(', '),width:384,height:379},
"aa_global_ink_texture_01":{src:url(a8v384),srcSet:[url(a8v192)+' 192w',url(a8v384)+' 384w',url(a8v768)+' 768w'].join(', '),width:384,height:192},
"aa_global_paper_grain_01":{src:url(a9v384),srcSet:[url(a9v192)+' 192w',url(a9v384)+' 384w',url(a9v768)+' 768w'].join(', '),width:384,height:384},
"aa_graph_contour_01":{src:url(a10v384),srcSet:[url(a10v192)+' 192w',url(a10v384)+' 384w',url(a10v768)+' 768w'].join(', '),width:384,height:256},
"aa_graph_mountain_01":{src:url(a11v384),srcSet:[url(a11v192)+' 192w',url(a11v384)+' 384w',url(a11v768)+' 768w'].join(', '),width:384,height:128},
"aa_home_atlas_fragment_01":{src:url(a12v384),srcSet:[url(a12v192)+' 192w',url(a12v384)+' 384w',url(a12v768)+' 768w'].join(', '),width:384,height:256},
"aa_learning_fossil_01":{src:url(a13v384),srcSet:[url(a13v192)+' 192w',url(a13v384)+' 384w',url(a13v768)+' 768w'].join(', '),width:384,height:351},
"aa_learning_seed_capsule_01":{src:url(a14v384),srcSet:[url(a14v192)+' 192w',url(a14v384)+' 384w',url(a14v768)+' 768w'].join(', '),width:384,height:420},
"aa_mindmap_branching_01":{src:url(a15v384),srcSet:[url(a15v192)+' 192w',url(a15v384)+' 384w',url(a15v768)+' 768w'].join(', '),width:384,height:256},
"aa_scientific_mica_01":{src:url(a16v384),srcSet:[url(a16v192)+' 192w',url(a16v384)+' 384w',url(a16v768)+' 768w'].join(', '),width:384,height:256},
"aa_sources_book_spine_01":{src:url(a17v384),srcSet:[url(a17v192)+' 192w',url(a17v384)+' 384w',url(a17v768)+' 768w'].join(', '),width:384,height:576},
"aa_timeline_astronomical_01":{src:url(a18v384),srcSet:[url(a18v192)+' 192w',url(a18v384)+' 384w',url(a18v768)+' 768w'].join(', '),width:384,height:384},
"aa_timeline_strata_01":{src:url(a19v384),srcSet:[url(a19v192)+' 192w',url(a19v384)+' 384w',url(a19v768)+' 768w'].join(', '),width:384,height:256}
};
