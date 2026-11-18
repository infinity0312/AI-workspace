import { test,expect,type Page,type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const destination=process.env.AKW_VISUAL_OUTPUT;
async function shot(page:Page,name:string){if(destination){await mkdir(destination,{recursive:true});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:resolve(destination,'assets-'+name+'.png'),fullPage:true,animations:'disabled'});}}
async function create(request:APIRequestContext,route:string,data:object){const response=await request.post('/api/v1'+route,{data});expect(response.ok(),await response.text()).toBeTruthy();return response.json();}
async function loaded(page:Page,asset:string){const picture=page.locator('[data-asset="'+asset+'"]').filter({visible:true}).first();await picture.scrollIntoViewIfNeeded();const img=picture.locator('img');await expect(img).toBeVisible();await expect.poll(()=>img.evaluate((node:HTMLImageElement)=>node.complete && node.naturalWidth>0)).toBe(true);return img;}

test('editorial assets load in the right states and choose independent mobile artwork',async({page,request})=>{
  const ws=await create(request,'/workspaces',{name:'测试夹具 · 素材验收'});
  const project=await create(request,'/workspaces/'+ws.id+'/projects',{name:'测试夹具 · 材料研究'});
  await page.addInitScript(id=>{localStorage.setItem('akw-last-workspace',id);localStorage.setItem('akw-preferences-v1',JSON.stringify({theme:'light',reopen:false}));},ws.id);
  await page.setViewportSize({width:1440,height:1000});await page.goto('/');await loaded(page,'home-atlas-desktop');await shot(page,'home-desktop');
  await page.setViewportSize({width:900,height:900});await loaded(page,'home-atlas-desktop');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(900);await shot(page,'home-medium');
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'切换首页插画'}).click();await loaded(page,'home-folio');
  const nav=()=>page.getByRole('navigation',{name:'主导航',exact:true});
  await nav().getByRole('button',{name:'项目',exact:true}).click();
  await page.getByRole('group',{name:'项目筛选'}).getByRole('button',{name:project.name}).click();
  await page.getByLabel('此设备的项目封面').selectOption('project-mineral');await loaded(page,'project-mineral');await shot(page,'project-cover');
  await page.getByLabel('此设备的项目封面').selectOption('project-discrete');await loaded(page,'project-discrete');
  await nav().getByRole('button',{name:'来源',exact:true}).click();await loaded(page,'collection-empty');await shot(page,'collection-desktop');
  await nav().getByRole('button',{name:'研究',exact:true}).click();await loaded(page,'research-process');await shot(page,'research-desktop');
  await page.setViewportSize({width:390,height:844});await page.getByRole('navigation',{name:'快捷切换'}).getByRole('button',{name:'工作台',exact:true}).click();
  const hero=await loaded(page,'home-atlas-desktop');expect(await hero.evaluate((img:HTMLImageElement)=>img.currentSrc)).toContain('home-atlas-mobile');await shot(page,'home-mobile');
  await page.getByRole('navigation',{name:'快捷切换'}).getByRole('button',{name:'资料库',exact:true}).click();
  const collection=await loaded(page,'collection-empty');expect(await collection.evaluate((img:HTMLImageElement)=>img.currentSrc)).toContain('collection-empty-mobile');await shot(page,'collection-mobile');
  await page.getByRole('button',{name:'打开导航'}).click();await nav().getByRole('button',{name:'学习',exact:true}).click();await loaded(page,'learning-empty');await shot(page,'learning-mobile');
  await page.getByRole('button',{name:'全局搜索'}).click();await page.getByLabel('搜索内容').fill('不存在的素材验收检索项');await page.getByRole('search').getByRole('button',{name:'搜索',exact:true}).click();await loaded(page,'search-empty');await shot(page,'search-mobile');
  const blank=await create(request,'/artifacts',{workspace_id:ws.id,title:'测试夹具 · 空专项视图',content:{schema_version:'1.0',relations:{source_ids:[],knowledge_node_ids:[]},blocks:['mindmap','timeline','evidence_network'].map(type=>({id:randomUUID(),type,attrs:{view_version:1,node_ids:[]}}))}});
  await page.goto('/?workspace='+ws.id+'&artifact='+blank.id);
  await loaded(page,'mindmap-empty');await loaded(page,'timeline-empty');await expect(page.getByText('当前范围还没有可浏览的证据或主张')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await shot(page,'inline-empty-mobile');
  const guide=await create(request,'/artifacts',{workspace_id:ws.id,title:'测试夹具 · 指南封面',content:{schema_version:'1.0',relations:{source_ids:[],knowledge_node_ids:[]},blocks:[{id:randomUUID(),type:'guide_step',attrs:{version:1,number:1,title:'整理资料'},children:[{type:'text',text:'测试夹具步骤，不代表已执行。'}]}]}});
  await page.goto('/?workspace='+ws.id+'&artifact='+guide.id);await loaded(page,'guide-manual');await shot(page,'guide-mobile');
  const course=await create(request,'/artifacts',{workspace_id:ws.id,title:'测试夹具 · 学习封面',content:{schema_version:'1.0',relations:{source_ids:[],knowledge_node_ids:[]},blocks:[{id:randomUUID(),type:'learning_goal',attrs:{version:1,goal:'测试夹具：学习知识组织',foundation:'初学者',basis:'provided',diagnostic:'测试夹具',views:[]}}]}});
  await page.goto('/?workspace='+ws.id+'&artifact='+course.id);await loaded(page,'learning-folio');await shot(page,'learning-folio-mobile');
});

test('failed image requests preserve a readable home and a neutral fallback',async({page,request})=>{
  const ws=await create(request,'/workspaces',{name:'测试夹具 · 素材回退'});
  await page.addInitScript(id=>localStorage.setItem('akw-last-workspace',id),ws.id);
  await page.route('**/*home-atlas-desktop*.webp',route=>route.abort());
  await page.goto('/');await expect(page.locator('.home-art [data-asset="home-atlas-desktop"]')).toHaveAttribute('data-failed','true');
  await expect(page.getByRole('textbox',{name:'你想查什么、完成什么或学会什么？'})).toBeVisible();await shot(page,'neutral-fallback');
});
