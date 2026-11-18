import { test,expect,type Page,type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// Explicit test fixtures. Never use a user's workspace or live provider credentials.
const shot=process.env.AKW_VISUAL_OUTPUT;
async function capture(page:Page,name:string) { if(shot) { await mkdir(shot,{ recursive:true });await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({ path:resolve(shot,name+'.png'),fullPage:true,animations:'disabled' }); } }
async function create(request:APIRequestContext,path:string,data:object) { const response=await request.post('/api/v1'+path,{ data });expect(response.ok(),await response.text()).toBeTruthy();return response.json(); }

test('editorial home keeps intent, supports projects and fits five light/dark viewports',async({ page,request })=>{
  const ws=await create(request,'/workspaces',{ name:'测试夹具 · 知识工作室' });
  const project=await create(request,'/workspaces/'+ws.id+'/projects',{ name:'测试夹具 · 城市与能源' });
  await create(request,'/artifacts',{ workspace_id:ws.id,project_id:project.id,title:'测试夹具 · 能源资料索引' });
  await page.addInitScript(id=>{ localStorage.setItem('akw-last-workspace',id);localStorage.setItem('akw-preferences-v1',JSON.stringify({ theme:'light',reopen:false })); },ws.id);
  await page.goto('/');
  await page.getByRole('button',{ name:'找资料' }).click();
  const intent=page.getByRole('textbox',{ name:'你想查什么、完成什么或学会什么？' });
  await expect(intent).toHaveValue('寻找图神经网络入门的权威来源');
  await expect(page.getByRole('button',{ name:'开始任务',exact:true })).toBeDisabled();
  await page.reload();await expect(intent).toHaveValue('寻找图神经网络入门的权威来源');
  for(const theme of ['light','dark'] as const) {
    for(const [width,height] of [[1440,900],[1280,800],[768,1024],[390,844],[360,800]]) {
      await page.setViewportSize({ width:width!,height:height! });
      await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
      await expect(page.getByRole('heading',{ name:ws.name,exact:true })).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width!);
      await capture(page,'home-'+theme+'-'+width);
    }
  }
  await page.setViewportSize({ width:1440,height:900 });
  await page.getByRole('navigation',{ name:'主导航' }).getByRole('button',{ name:'项目',exact:true }).click();
  await page.getByRole('group',{ name:'项目筛选' }).getByRole('button',{ name:project.name }).click();
  await expect(page.getByRole('heading',{ name:project.name })).toBeVisible();
  await expect(page.getByRole('button',{ name:'测试夹具 · 能源资料索引' }).last()).toBeVisible();
  await capture(page,'projects-desktop');
  await page.keyboard.press('Control+k');await expect(page.getByRole('heading',{ name:'搜索',exact:true })).toBeVisible();
  await page.setViewportSize({ width:390,height:844 });
  await page.getByRole('button',{ name:'打开导航' }).click();
  await expect(page.locator('.sidebar.mobile-open')).toHaveCSS('position','fixed');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation',{ name:'主导航' })).toBeHidden();
});

test('knowledge renderers keep unknown dates, crosslinks, missing values and the canonical revision',async({ page,request })=>{
  const ws=await create(request,'/workspaces',{ name:'测试夹具 · 专项渲染' });
  const parent=await create(request,'/knowledge/nodes',{ workspace_id:ws.id,title:'测试夹具 · 能源',type:'concept' });
  const child=await create(request,'/knowledge/nodes',{ workspace_id:ws.id,title:'测试夹具 · 太阳能',type:'concept',event_date:'2020' });
  const other=await create(request,'/knowledge/nodes',{ workspace_id:ws.id,title:'测试夹具 · 风能',type:'concept' });
  for(const [from,to,relation] of [[child.id,parent.id,'is_a'],[parent.id,child.id,'is_a'],[other.id,child.id,'related_to']]) {
    const edge=await create(request,'/knowledge/edges/suggestions',{ workspace_id:ws.id,from_node_id:from,to_node_id:to,relation_type:relation });
    await create(request,'/knowledge/reviews/'+edge.id+'/resolve',{ decision:'confirmed' });
  }
  const artifact=await create(request,'/artifacts',{ workspace_id:ws.id,title:'测试夹具 · 知识图册',content:{ schema_version:'1.0',relations:{ source_ids:[],knowledge_node_ids:[parent.id,child.id,other.id] },blocks:[
    ...['timeline','mindmap','graph_embed','evidence_network'].map(type=>({ id:randomUUID(),type,attrs:{ view_version:1,node_ids:[],root_id:parent.id } })),
    { id:randomUUID(),type:'table',attrs:{ table_version:1,title:'测试夹具 · 方案对照',rows:[['维度','太阳能','风能'],['成本','未核实',''],['范围','屋顶','沿海']] } },
  ] } });
  // Projection fixture models a zero-evidence claim, which the production UI must not hide.
  await page.route('**/api/v1/artifacts/'+artifact.id+'/projection',async route=>{ const response=await route.fetch();const value=await response.json();value.references.claims.push({ id:randomUUID(),statement:'测试夹具 · 尚无证据的主张',scope:'测试',status:'proposed',evidence_ids:[],block_ids:[artifact.revision.content_json.blocks[3].id] });await route.fulfill({ response,json:value }); });
  await page.goto('/?workspace='+ws.id+'&artifact='+artifact.id);
  const tabs=page.getByRole('navigation',{name:'文档内容索引'});
  const timeline=page.getByRole('region',{name:'时间脉络',exact:true});
  const graph=page.getByRole('region',{name:'关系图谱',exact:true});
  async function graphMode(label:string){await graph.getByRole('button',{name:'视图选项',exact:true}).click();await page.getByRole('dialog',{name:'视图选项',exact:true}).getByRole('button',{name:label,exact:true}).click();await page.keyboard.press('Escape');}
  async function timelineMode(label:string){await timeline.getByRole('button',{name:'视图选项',exact:true}).click();await page.getByRole('dialog',{name:'视图选项',exact:true}).getByRole('button',{name:label,exact:true}).click();await page.keyboard.press('Escape');}
  await tabs.getByRole('button',{ name:'时间脉络',exact:true }).click();
  await expect(page.locator('.undated-index')).toContainText('时间未确定（2）');
  await expect(page.locator('.projection-timeline time')).toHaveText(['2020']);
  await timeline.getByRole('button',{name:'时间窗口',exact:true}).click();await page.getByLabel('时间起点').fill('2020-01-01');await page.keyboard.press('Escape');await expect(page.locator('.undated-index')).not.toHaveAttribute('open');
  await timelineMode('横向图册');
  await expect(page.locator('.chronicle-horizontal time')).toHaveText(['2020']);
  await capture(page,'timeline-horizontal');
  await timelineMode('纵向编年');
  await capture(page,'timeline-desktop');
  await tabs.getByRole('button',{ name:'思维导图',exact:true }).click();
  await expect(page.getByText('交叉关系与非层级关系（2）')).toBeVisible();
  await page.getByRole('button',{ name:'折叠全部分支' }).click();await page.getByRole('button',{ name:'展开全部分支' }).click();
  await capture(page,'mindmap-desktop');
  await tabs.getByRole('button',{ name:'关系图谱',exact:true }).click();
  await graph.getByRole('button',{name:'返回全局',exact:true}).click();
  await graphMode('分类图册');
  await expect(page.locator('.atlas-cluster li')).toHaveCount(3);
  await capture(page,'graph-clusters');
  await graphMode('节点列表');await expect(graph.locator('.node-index > li')).toHaveCount(3);
  await graphMode('图谱');await expect(page.locator('.react-flow')).toBeVisible();
  await capture(page,'graph-desktop');
  await tabs.getByRole('button',{ name:'证据网络',exact:true }).click();
  await expect(page.getByText('测试夹具 · 尚无证据的主张',{ exact:true })).toBeVisible();await expect(page.getByText('缺少证据 · 未核实')).toBeVisible();
  await capture(page,'evidence-desktop');
  await tabs.getByRole('button',{ name:'测试夹具 · 方案对照',exact:true }).click();
  await expect(page.getByRole('cell',{ name:'未提供',exact:true })).toBeVisible();
  await page.getByRole('button',{ name:'单对象详情',exact:true }).click();await page.getByLabel('比较对象').selectOption('2');
  await expect(page.locator('.comparison-detail dd').first()).toHaveText('未提供');
  await page.getByRole('button',{ name:'对照表',exact:true }).click();
  for(const width of [1440,1280,768,390,360]) {
    await page.setViewportSize({ width,height:900 });
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await capture(page,'comparison-'+width);
  }
  await page.getByRole('button',{ name:'检查器',exact:true }).click();
  await expect(page.locator('.inspector.inspector-open')).toHaveCSS('position','fixed');
  await capture(page,'inspector-mobile');
  await page.getByRole('button',{ name:'关闭检查器',exact:true }).click();
  const current=await (await request.get('/api/v1/artifacts/'+artifact.id)).json();
  expect(current.revision.id).toBe(artifact.revision.id);
});

test('activity exposes service errors and retry instead of a fabricated empty state',async({ page,request })=>{
  const ws=await create(request,'/workspaces',{ name:'测试夹具 · 活动异常' });
  await page.addInitScript(id=>localStorage.setItem('akw-last-workspace',id),ws.id);
  await page.goto('/');await page.route('**/api/v1/research-runs?**',route=>route.fulfill({ status:503,json:{ error:{ code:'UNAVAILABLE',message:'测试夹具：服务暂不可用' } } }));
  await page.getByRole('navigation',{ name:'主导航' }).getByRole('button',{ name:'活动',exact:true }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('测试夹具：服务暂不可用');
  await capture(page,'activity-error');
  await page.unroute('**/api/v1/research-runs?**');await page.getByRole('button',{ name:'重新加载' }).click();
  await expect(page.getByRole('heading',{ name:'一切从一次探索开始' })).toBeVisible();
});
