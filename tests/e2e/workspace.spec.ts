import { expect, test } from '@playwright/test';

test('create, edit offline, sync, and verify narrow layout', async ({ page, context, request }) => {
  const title = '离线工作空间 ' + Date.now();
  const prior=await(await request.get('/api/v1/workspaces')).json();
  await page.goto('/');
  if(prior.length){await page.getByRole('navigation',{name:'主导航'}).getByRole('button',{name:'设置',exact:true}).click();const form=page.locator('form').filter({has:page.getByRole('heading',{name:'新建工作空间',exact:true})});await form.getByRole('textbox',{name:'名称',exact:true}).fill(title);await form.getByRole('button',{name:'创建工作空间',exact:true}).click();}else{await page.getByRole('textbox',{ name:'工作空间名称' }).fill(title);await page.getByRole('button',{ name:'创建工作空间' }).click();}
  await expect(page.getByRole('heading',{ name:title })).toBeVisible();
  await page.getByText('手动组织项目与文档',{ exact:true }).click();
  await page.getByRole('textbox',{ name:'项目名称' }).fill('研究项目');
  await page.getByRole('button',{ name:'创建项目' }).click();
  await expect(page.getByText('研究项目',{ exact:true }).first()).toBeVisible();
  await page.getByRole('textbox',{ name:'文档标题' }).fill('离线笔记');
  await page.getByRole('button',{ name:'创建空白文档' }).click();
  await expect(page.getByRole('heading',{ name:'离线笔记' })).toBeVisible();

  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await expect(page.getByText('离线',{ exact:true })).toBeVisible();
  await page.getByRole('button',{ name:'编辑模式' }).click();
  await page.getByRole('button',{ name:'＋ 添加内容块',exact:true }).click();
  await page.getByRole('textbox',{ name:'内容', exact:true }).fill('保存在本机的研究记录。');
  await page.getByRole('button',{ name:'保存内容块' }).click();
  await expect(page.getByText('保存在本机的研究记录。',{ exact:true })).toBeVisible();
  await expect(page.getByText(/修改已保存在此设备/)).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading',{ name:'离线笔记' })).toBeVisible({ timeout:15000 });
  await expect(page.getByText('保存在本机的研究记录。',{ exact:true })).toBeVisible();
  await expect(page.getByText(/修改已保存在此设备/)).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(/版本 2 · 已同步/)).toBeVisible({ timeout:15000 });
  const workspaces = await (await request.get('/api/v1/workspaces')).json() as { id:string; name:string }[];
  const id = workspaces.find(item => item.name === title)!.id;
  const artifacts = await (await request.get('/api/v1/artifacts?workspace_id=' + id)).json() as { id:string }[];
  const document = await (await request.get('/api/v1/artifacts/' + artifacts[0]!.id)).json();
  expect(document.revision.content_json.blocks[0].children[0].text).toBe('保存在本机的研究记录。');

  await page.setViewportSize({ width:390,height:844 });
  await page.getByRole('button',{ name:'打开导航' }).click();
  await expect(page.getByRole('navigation',{ name:'主导航' })).toBeVisible();
  await page.getByRole('navigation',{ name:'主导航' }).getByRole('button',{ name:'来源' }).click();
  await expect(page.getByRole('heading',{ name:'来源',exact:true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('paste a source, produce a research artifact, and open its original evidence', async ({ page, request }) => {
  const workspace = await (await request.post('/api/v1/workspaces',{ data:{ name:'证据测试 ' + Date.now() } })).json() as { id:string };
  await page.addInitScript(id => localStorage.setItem('akw-last-workspace',id),workspace.id);
  await page.goto('/');
  await page.getByRole('navigation',{ name:'主导航' }).getByRole('button',{ name:'来源',exact:true }).click();
  await page.locator('summary').filter({hasText:'导入新资料'}).click();
  await page.getByRole('textbox',{ name:'标题',exact:true }).fill('研究原文');
  await page.getByRole('textbox',{ name:'正文',exact:true }).fill('图神经网络聚合相邻节点的信息。');
  await page.getByRole('button',{ name:'添加来源' }).click();
  await expect(page.getByRole('button',{ name:'研究原文' })).toBeVisible();
  await page.getByRole('navigation',{ name:'主导航' }).getByRole('button',{ name:'研究',exact:true }).click();
  await page.locator('summary').filter({hasText:'开始一次研究'}).click();
  await page.getByRole('textbox',{ name:'研究目标' }).fill('图神经网络的聚合过程');
  await page.getByLabel('使用来源').selectOption({ label:'研究原文' });
  await page.getByRole('button',{ name:'开始任务' }).click();
  await page.getByRole('button',{ name:'打开研究文档' }).click({ timeout:15000 });
  await expect(page.getByRole('heading',{ name:'图神经网络的聚合过程' })).toBeVisible();
  await page.getByRole('button',{ name:'证据',exact:true }).first().click();
  await expect(page.getByRole('heading',{ name:'原文证据' })).toBeVisible();
  await expect(page.locator('.inspector blockquote')).toContainText('图神经网络聚合');
  if (process.env.AKW_SCREENSHOT_PATH) await page.screenshot({ path:process.env.AKW_SCREENSHOT_PATH,fullPage:true });
});

test('create and analyze opens the document flow and requires explicit model consent', async ({ page, request }) => {
  const ws = await (await request.post('/api/v1/workspaces',{ data:{ name:'新建分析验收 ' + Date.now() } })).json() as { id:string };
  await page.addInitScript(id => localStorage.setItem('akw-last-workspace',id),ws.id);
  await page.goto('/');
  await page.getByText('手动组织项目与文档',{ exact:true }).click();
  await page.getByRole('textbox',{ name:'文档标题' }).fill('居里夫人的研究生涯与科学贡献');
  await page.getByRole('button',{ name:'创建并分析' }).click();
  const panel = page.locator('section[aria-label="生成文档分析"]');
  await expect(panel).toHaveCount(1);
  await expect(panel).toContainText('当前工作空间的数据策略尚未允许使用外部模型。');
  await page.getByRole('button',{ name:'打开数据策略设置',exact:true }).click();
  await page.getByRole('checkbox',{ name:'允许单独授权外部模型和搜索' }).check();
  await page.getByRole('button',{ name:'保存策略' }).click();
  await expect(page.getByText('工作空间策略已保存')).toBeVisible();
  await page.getByRole('button',{ name:'居里夫人的研究生涯与科学贡献',exact:true }).click();
  await page.getByRole('button',{ name:'AI 生成分析',exact:true }).click();
  await expect(panel.getByRole('textbox',{ name:'分析目标' })).toHaveValue('居里夫人的研究生涯与科学贡献');
  const generate = panel.getByRole('button',{ name:'生成分析提案' });
  await expect(generate).toBeDisabled();
  await panel.getByRole('checkbox',{ name:'允许本次输入用于联网检索和分析' }).check();
  await expect(generate).toBeEnabled();
  if (process.env.AKW_TEST_DEEPSEEK !== 'true') return;
  test.setTimeout(150000);

  await generate.click();
  const preview = panel.getByRole('region',{ name:'分析提案预览' });
  await expect(preview.getByRole('heading',{ name:'AI 分析',exact:true })).toBeVisible({ timeout:115000 });
  await expect(page.locator('.artifact-content').getByRole('heading',{ name:'AI 分析',exact:true })).toHaveCount(0);
  await expect(preview).not.toContainText(/待核实|待复核|未经资料验证/);
  await expect(preview.getByRole('heading',{ name:'参考论文' })).toBeVisible();
  await expect(preview.getByRole('img').first()).toBeVisible();
  await preview.getByRole('button',{ name:'写入当前文档' }).click();
  const document = page.locator('.artifact-content');
  await expect(document.getByRole('heading',{ name:'AI 分析',exact:true })).toBeVisible();
  await expect(document.getByRole('img').first()).toBeVisible();
  await expect(document.getByRole('heading',{ name:'参考论文' })).toBeVisible();
  await document.getByRole('button',{ name:'图片来源' }).first().click();
  await expect(page.getByRole('link',{ name:'打开来源',exact:true })).toHaveAttribute('href',/^https:\/\/commons\.wikimedia\.org\//);
  await expect(page.getByText(/版本 2 · 已同步/)).toBeVisible();
});

test('organize capture, review a flashcard, and recover a document through the user interface', async ({ page, request }) => {
  const ws = await (await request.post('/api/v1/workspaces',{ data:{ name:'工作台流程 ' + Date.now() } })).json() as { id:string };
  await page.addInitScript(id => localStorage.setItem('akw-last-workspace',id),ws.id);
  await page.goto('/');
  const nav = page.getByRole('navigation',{ name:'主导航' });
  await nav.getByRole('button',{ name:'收件箱' }).click();
  await page.getByLabel('资料标题').fill('待整理笔记');
  await page.getByLabel('资料正文').fill('一个可以复习的定义。');
  await page.getByRole('button',{ name:'保存到收件箱' }).click();
  await page.getByRole('button',{ name:'转为知识笔记' }).click();
  await page.getByRole('button',{name:'收件箱状态 · 待整理',exact:true}).click();await page.getByRole('radio',{name:'已整理',exact:true}).check();await page.keyboard.press('Escape');
  await page.getByRole('button',{ name:'打开整理结果' }).click();
  await expect(page.getByRole('heading',{ name:'待整理笔记',exact:true })).toBeVisible();
  await expect(page.getByText('一个可以复习的定义。',{ exact:true })).toBeVisible();
  await page.getByRole('button',{ name:'批注',exact:true }).click();
  await page.getByLabel('批注内容').fill('请补一个例子。');
  await page.getByRole('button',{ name:'添加批注' }).click();
  await expect(page.getByText('请补一个例子。',{ exact:true })).toBeVisible();
  await page.getByRole('button',{ name:'标记已解决' }).click();
  await expect(page.getByRole('button',{ name:'重新开启批注' })).toBeVisible();

  await page.getByRole('button',{ name:'制作复习卡' }).click();
  await expect(page.getByLabel('关联文档').locator('option:checked')).toHaveText('待整理笔记');
  await page.getByLabel('问题',{ exact:true }).fill('这条笔记是什么？');
  await page.getByLabel('答案',{ exact:true }).fill('一个定义。');
  await page.getByLabel('关联文档').selectOption({ label:'待整理笔记' });
  await page.getByRole('button',{ name:'保存卡片' }).click();
  await page.getByRole('button',{ name:'查看答案' }).click();
  await expect(page.getByText('一个定义。',{ exact:true })).toBeVisible();
  await page.getByRole('button',{ name:'记得',exact:true }).click();
  await expect(page.getByText('当前没有到期卡片。')).toBeVisible();

  await page.getByRole('complementary').first().getByRole('button',{ name:'待整理笔记',exact:true }).click();
  await page.getByRole('button',{ name:'版本记录' }).click();
  page.once('dialog',dialog => void dialog.accept());
  await page.getByRole('button',{ name:'移至回收站' }).click();
  await expect(page.getByRole('heading',{ name:'回收站',exact:true })).toBeVisible();
  await page.getByRole('button',{ name:'恢复文档' }).click();
  await expect(page.getByRole('heading',{ name:'待整理笔记',exact:true })).toBeVisible();
});

test('compose diagrams, a dated view and LaTeX in one saved document',async ({ page,request }) => {
  const post = async (route:string,data:object) => {
    const response = await request.post('/api/v1' + route,{ data });
    expect(response.ok()).toBeTruthy();
    return response.json();
  };
  const ws = await post('/workspaces',{ name:'可组合工作台 ' + Date.now() });
  const first = await post('/knowledge/nodes',{ workspace_id:ws.id,title:'起始事件',type:'event',event_date:'2020' });
  const second = await post('/knowledge/nodes',{ workspace_id:ws.id,title:'后续事件',type:'event',event_date:'2021-03-05' });
  const edge = await post('/knowledge/edges/suggestions',{ workspace_id:ws.id,from_node_id:first.id,to_node_id:second.id,relation_type:'depends_on' });
  await post('/knowledge/reviews/' + edge.id + '/resolve',{ decision:'confirmed' });
  await page.addInitScript(id => localStorage.setItem('akw-last-workspace',id),ws.id);
  await page.goto('/');
  await page.getByText('手动组织项目与文档',{ exact:true }).click();
  await page.getByRole('textbox',{ name:'文档标题' }).fill('组合研究文档');
  await page.getByRole('button',{ name:'创建空白文档' }).click();
  await expect(page.getByRole('heading',{ name:'组合研究文档' })).toBeVisible();
  await page.getByRole('button',{ name:'编辑模式' }).click();

  async function block(kind:string,label:string,value:string) {
    await page.getByRole('button',{ name:'＋ 添加内容块',exact:true }).click();
    await page.getByLabel('内容类型').selectOption({ label:kind });
    await page.getByLabel(label,{ exact:true }).fill(value);
    await page.getByRole('button',{ name:'保存内容块' }).click();
  }
  await block('段落','内容','概率公式 \\(P(A\\mid B)=\\frac{P(A\\cap B)}{P(B)}\\)。');
  await block('公式','内容','\\begin{aligned}a &= \\sum_{n=1}^{3}n\\\\b &= \\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}\\end{aligned}');
  await block('思维导图','视图标题','研究分支');
  await block('时间脉络','视图标题','研究历程');
  await block('关系图谱','视图标题','研究关系');

  const body = page.locator('.artifact-content');
  await expect(body.locator('.katex')).toHaveCount(2);
  const map = body.getByRole('region',{ name:'研究分支' });
  await expect(map.getByRole('button',{name:'后续事件',exact:true})).toBeVisible();
  const timeline = body.getByRole('region',{ name:'研究历程' });
  await expect(timeline.locator('time')).toHaveText(['2020','2021-03-05']);
  const graph = body.getByRole('region',{ name:'研究关系' });
  await expect(graph.locator('.react-flow')).toBeVisible();
  await expect(graph.locator('.react-flow__edge-text')).toContainText('依赖');
  await graph.locator('..').getByRole('button',{ name:'编辑',exact:true }).click();
  await page.getByLabel('包含的节点',{ exact:false }).selectOption([first.id]);
  await page.getByRole('button',{ name:'保存视图设置' }).click();
  await expect(graph.locator('.result-summary')).toContainText('0 条当前关系');
  await expect(page.getByText(/版本 \d+ · 已同步/)).toBeVisible({ timeout:15000 });
  await page.reload();
  await expect(body.getByRole('region',{ name:'研究历程' }).locator('time')).toHaveText(['2020','2021-03-05']);
  await expect(body.locator('.katex')).toHaveCount(2);
  await expect(page.getByRole('group',{ name:'工作区视图' })).toHaveCount(0);
  await page.getByRole('button',{ name:'编辑模式',exact:true }).click();
  await timeline.locator('..').getByRole('button',{ name:'删除内容块' }).click();
  await expect(timeline).toHaveCount(0);
  const mapBlock=map.locator('..');
  await mapBlock.getByRole('button',{ name:'在此后添加内容块' }).click();
  await mapBlock.getByLabel('内容类型').selectOption('timeline');
  await mapBlock.getByLabel('视图标题').fill('补充时间线');
  await mapBlock.getByRole('button',{ name:'保存内容块' }).click();
  await expect(mapBlock.locator('xpath=following-sibling::section[1]').getByRole('region',{ name:'补充时间线' })).toBeVisible();
  await expect(body.getByRole('region',{ name:'研究关系' })).toBeVisible();
  await expect(body.locator('.katex')).toHaveCount(2);
});

test('workspace data, references, PDF, dependency graph and revision export work together',async ({ page,request }) => {
  await page.setViewportSize({ width:1440,height:920 });
  async function create(route:string,data:object) {
    const response = await request.post('/api/v1'+route,{ data });
    expect(response.ok(),await response.text()).toBeTruthy();
    return response.json();
  }
  const ws = await create('/workspaces',{ name:'工作台验收 '+Date.now() });
  const start = await create('/knowledge/nodes',{ workspace_id:ws.id,title:'标定方法',type:'method' });
  const target = await create('/knowledge/nodes',{ workspace_id:ws.id,title:'重复测量',type:'concept' });
  const relation = await create('/knowledge/edges/suggestions',{ workspace_id:ws.id,from_node_id:target.id,to_node_id:start.id,relation_type:'depends_on' });
  await create('/knowledge/reviews/'+relation.id+'/resolve',{ decision:'confirmed' });
  const { default:PDFDocument } = await import('pdfkit');
  const pdf = new PDFDocument();
  const chunks:Buffer[] = [];
  const complete = new Promise<Buffer>((resolve,reject) => {
    pdf.on('data',chunk => chunks.push(chunk)); pdf.on('error',reject);
    pdf.on('end',() => resolve(Buffer.concat(chunks)));
  });
  pdf.text('Measurement protocol and calibration on page one.');
  pdf.addPage().text('Trial 2 measured a value of 25 units.');
  pdf.end();
  const asset = await create('/assets',{ workspace_id:ws.id,name:'experiment.pdf',mime:'application/pdf',data_base64:(await complete).toString('base64'),export_rights:'user_owned' });
  const source = await create('/sources',{ workspace_id:ws.id,title:'标定实验原始报告',asset_id:asset.id,rights:'user_owned' });
  await create('/sources/'+source.id+'/ingest',{});
  const sourceDetail = async () => (await request.get('/api/v1/sources/'+source.id)).json();
  await expect.poll(async () => (await sourceDetail()).status,{ timeout:30000 }).toBe('parsed');
  const passage = (await sourceDetail()).passages.find((item:{ page:number }) => item.page===2);
  const proof = await create('/sources/'+source.id+'/evidence',{ passage_id:passage.id,start_utf16:0,end_utf16:passage.content.length });
  const { randomUUID:id } = await import('node:crypto');
  const heading = { id:id(),type:'heading',attrs:{ level:2 },children:[{ type:'text',text:'试验记录' }] };
  const table = { id:id(),type:'table',attrs:{ table_version:1,title:'实测数据',rows:[['批次','样品'],['第一批','7'],['第二批','25']] } };
  const checklist = { id:id(),type:'interactive',attrs:{ kind:'checklist',title:'实验步骤',items:[{ text:'完成校准',done:false }] } };
  const chart = { id:id(),type:'chart',attrs:{ chart_version:1,title:'标定趋势',kind:'line',table_id:table.id,x_label:'批次',y_label:'测量值',series:[{ name:'样品',points:[{ x:1,y:0 }] }] } };
  const artifact = await create('/artifacts',{ workspace_id:ws.id,title:'标定研究工作台',kind:'document',content:{
    schema_version:'1.0',relations:{ source_ids:[source.id],knowledge_node_ids:[] },blocks:[heading,table,chart,checklist,
      { id:id(),type:'paragraph',children:[{ type:'wiki_link',text:'标定方法',attrs:{ node_id:start.id } }] },
      { id:id(),type:'evidence_reference',attrs:{ evidence_id:proof.id } },
      { id:id(),type:'dependency_graph',attrs:{ view_version:1,node_ids:[start.id,target.id] } },
      { id:id(),type:'evidence_network',attrs:{ view_version:1,node_ids:[] } },
    ],
  } });
  await page.goto('/?workspace='+ws.id+'&artifact='+artifact.id);
  await expect(page.getByRole('heading',{ name:'标定研究工作台' })).toBeVisible();
  await page.getByText('文档目录',{ exact:true }).click();
  await page.getByRole('navigation',{ name:'文档目录' }).getByRole('button',{ name:'试验记录' }).click();
  await expect(page.locator('#block-'+heading.id)).toBeFocused();
  await expect(page.locator('.artifact-content .dependency-map')).toBeVisible();await expect(page.locator('.dependency-node')).toHaveCount(2);
  const network = page.getByRole('region',{ name:'证据网络' });
  await expect(network.getByText('Trial 2 measured a value of 25 units.')).toBeVisible();
  await network.getByRole('button',{ name:'标定实验原始报告 · 第 2 页' }).click();
  await page.getByRole('button',{ name:'在检查器阅读来源' }).click();
  await expect(page.locator('canvas[aria-label="PDF 第 2 页"]')).toBeVisible({ timeout:25000 });
  await page.getByRole('button',{ name:'上一页' }).click();
  await expect(page.locator('canvas[aria-label="PDF 第 1 页"]')).toBeVisible();
  await network.getByRole('button',{ name:'正文引用 1' }).click();
  await page.getByRole('button',{ name:'编辑模式',exact:true }).click();
  await page.getByRole('checkbox',{ name:'完成校准' }).click();
  await expect(page.getByText(/版本 2 · 已同步/)).toBeVisible();
  await page.locator('#block-'+table.id).getByRole('button',{ name:'编辑',exact:true }).click();
  await page.getByRole('textbox',{ name:'表格 3 行 2 列' }).fill('31');
  await page.getByRole('button',{ name:'保存内容块' }).click();
  await expect(page.getByText(/版本 3 · 已同步/)).toBeVisible();
  const visual = page.getByRole('region',{ name:'标定趋势' });
  await visual.getByText('查看图表数据').click();
  await expect(visual.getByRole('cell',{ name:'31',exact:true })).toBeVisible();
  await page.getByRole('button',{ name:'检查器',exact:true }).click();
  await expect(page.getByRole('heading',{ name:'检查器',exact:true })).toBeHidden();
  await page.reload();
  await expect(page.getByRole('heading',{ name:'检查器',exact:true })).toBeHidden();
  await page.getByRole('button',{ name:'导出',exact:true }).last().click();
  await page.getByLabel('文件格式').selectOption('svg');
  await page.getByLabel('文档版本').selectOption(artifact.revision.id);
  await page.getByLabel('要导出的视图').selectOption(chart.id);
  await page.getByRole('button',{ name:'开始导出' }).click();
  await expect(page.getByText('artifact-'+artifact.id+'.svg')).toBeVisible({ timeout:25000 });
  const jobs = await (await request.get('/api/v1/exports?workspace_id='+ws.id)).json();
  const download = await request.get('/api'+jobs[0].result.download_url);
  expect(await download.text()).toContain('<title>标定趋势</title>');
  const references = await request.get('/api/v1/knowledge/nodes/'+start.id+'/backlinks');
  expect(references.ok(),await references.text()).toBeTruthy();
  expect(await references.json()).toEqual([expect.objectContaining({ id:artifact.id,title:'标定研究工作台' })]);
});


test('split and merge paragraphs, preserve an inline footnote and save a figure annotation',async ({ page,request }) => {
  const ws = await (await request.post('/api/v1/workspaces',{ data:{ name:'正文编辑验收 '+Date.now() } })).json();
  const { randomUUID:id } = await import('node:crypto');
  const heading = id();
  const paragraph = id();
  const artifact = await (await request.post('/api/v1/artifacts',{ data:{ workspace_id:ws.id,title:'正文结构编辑',content:{
    schema_version:'1.0',relations:{ source_ids:[],knowledge_node_ids:[] },blocks:[
      { id:heading,type:'heading',attrs:{ level:2 },children:[{ type:'text',text:'操作记录' }] },
      { id:paragraph,type:'paragraph',children:[{ type:'text',text:'AlphaBeta' }] },
    ],
  } } })).json();
  await page.goto('/?workspace='+ws.id+'&artifact='+artifact.id);
  await page.getByRole('button',{ name:'编辑模式',exact:true }).click();
  await page.locator('#block-'+paragraph).getByRole('button',{ name:'编辑',exact:true }).click();
  const editor = page.getByRole('textbox',{ name:'编辑文字' });
  await editor.press('Home');
  for (let i=0;i<5;i++) await editor.press('ArrowRight');
  await page.getByRole('button',{ name:'在光标处拆分' }).click();
  await expect(page.locator('.artifact-block p')).toHaveText(['Alpha','Beta']);
  await page.getByRole('button',{ name:'合并到上一段' }).click();
  await expect(page.locator('.artifact-block p')).toHaveCount(1);
  await page.locator('#block-'+paragraph).getByRole('button',{ name:'编辑',exact:true }).click();
  await editor.press('End');
  await page.getByText('插入知识链接、证据或公式',{ exact:true }).click();
  await page.getByLabel('插入类型').selectOption('footnote');
  await page.getByLabel('脚注内容').fill('对测量条件的补充说明。');
  await page.getByRole('button',{ name:'插入到光标位置' }).click();
  await page.getByRole('button',{ name:'保存内容块' }).click();
  await page.getByRole('button',{ name:'脚注',exact:true }).click();
  await expect(page.getByText('对测量条件的补充说明。')).toBeVisible();
  await page.getByRole('button',{ name:'＋ 添加内容块',exact:true }).click();
  await page.getByLabel('内容类型').selectOption('image');
  await page.getByLabel('图片文件').setInputFiles('apps/api/tests/fixtures/ocr-atlas.png');
  await page.getByLabel('使用权利').selectOption('user_owned');
  await page.getByText('图片标注',{ exact:true }).click();
  await page.getByRole('button',{ name:'添加标注' }).click();
  await page.getByLabel('标注 1',{ exact:true }).fill('实验标签');
  await page.getByRole('button',{ name:'保存内容块' }).click();
  await expect(page.locator('.image-mark')).toHaveAttribute('title','实验标签');
  await expect(page.locator('.image-notes li')).toHaveText('实验标签');
});


test('evidence network refreshes after a document revision adds a citation',async ({ page,request }) => {
  const post = async (path:string,data:object) => {
    const response=await request.post('/api/v1'+path,{ data });
    expect(response.ok(),await response.text()).toBeTruthy();
    return response.json();
  };
  const ws=await post('/workspaces',{ name:'引用刷新 '+Date.now() });
  const source=await post('/sources',{ workspace_id:ws.id,title:'现场观测记录',text:'这里记录了现场观测所得的原始结果。' });
  const details=await (await request.get('/api/v1/sources/'+source.id)).json();
  const passage=details.passages[0];
  const evidence=await post('/sources/'+source.id+'/evidence',{ passage_id:passage.id,start_utf16:0,end_utf16:passage.content.length });
  const artifact=await post('/artifacts',{ workspace_id:ws.id,title:'引用刷新文档',content:{ schema_version:'1.0',relations:{ source_ids:[],knowledge_node_ids:[] },blocks:[{ id:crypto.randomUUID(),type:'evidence_network',attrs:{ view_version:1,node_ids:[] } }] } });
  await page.goto('/?workspace='+ws.id+'&artifact='+artifact.id);
  const network=page.getByRole('region',{ name:'证据网络' });
  await expect(network.getByText('当前范围还没有可浏览的证据或主张',{ exact:true })).toBeVisible();
  await page.getByRole('button',{ name:'编辑模式',exact:true }).click();
  await page.getByRole('button',{ name:'＋ 添加内容块',exact:true }).click();
  await page.getByLabel('内容类型').selectOption('evidence_reference');
  await page.getByRole('combobox',{ name:'证据引用',exact:true }).selectOption(evidence.id);
  await page.getByRole('button',{ name:'保存内容块' }).click();
  await expect(page.getByText(/版本 2 · 已同步/)).toBeVisible();
  await expect(network.getByText(passage.content,{ exact:true })).toBeVisible();
  await expect(network.getByRole('button',{ name:'正文引用 1',exact:true })).toBeVisible();
});

