import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';


const root=resolve(__dirname,'../../../packages/client/src/assets');
const manifest=JSON.parse(readFileSync(resolve(root,'manifest.json'),'utf8')) as {assets:{id:string;source:string;prompt_id:string;prompt_text:string;approved_by:string|null;dimensions:{width:number;height:number};variants:{filename:string;width:number;height:number;bytes:number}[];}[]};
test('editorial asset delivery includes the 30 accepted concepts and every referenced file',()=>{
  assert.equal(manifest.assets.length,30);
  assert.equal(new Set(manifest.assets.map(a=>a.id)).size,30);
  for(const asset of manifest.assets){
    assert.ok(asset.prompt_id && asset.prompt_text,'prompt provenance is required');
    assert.equal(asset.approved_by,null,'do not fabricate human approval');
    assert.ok(existsSync(resolve(root,asset.source)));
    assert.ok(asset.dimensions.width>0 && asset.dimensions.height>0);
    assert.ok(asset.variants.length>0);
    for(const variant of asset.variants){assert.ok(existsSync(resolve(root,variant.filename)));assert.ok(variant.width<=asset.dimensions.width,'optimized assets must not be enlarged');assert.ok(variant.bytes>0);}
  }
});
test('nine empty-state families and the home each have an independent portrait source',()=>{
  for(const family of ['search-empty','collection-empty','learning-empty','error-recovery','offline-preserved','mindmap-empty','timeline-empty','evidence-empty','comparison-empty']){
    const desktop=manifest.assets.find(a=>a.id===family)!,mobile=manifest.assets.find(a=>a.id===family+'-mobile')!;
    assert.ok(desktop && mobile);assert.notEqual(desktop.source,mobile.source);assert.ok(mobile.dimensions.height>mobile.dimensions.width);
  }
  assert.ok(manifest.assets.some(a=>a.id==='home-atlas-mobile'));
});
