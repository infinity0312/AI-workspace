import { test,expect,type APIRequestContext,type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
const outputDir=resolve(process.cwd(),process.env.AKW_QA_OUTPUT_DIR ?? '.data/harness-final');
const cases=[
  { key:'curie',title:'居里夫人两次诺贝尔奖',goal:'用中文写给高中生。比较居里夫人两次诺贝尔奖的年份、奖项和准确获奖理由。区分贝克勒尔发现自发放射性、居里夫妇共同研究、玛丽与合作者发现钋镭及分离镭。明确哪些成果不能归给一个人。以诺贝尔奖官网为事实来源，找一张有署名和许可的照片。' },
  { key:'hash',title:'SHA-256 与 SHA3-256 对照',goal:'用中文给软件开发入门者比较 SHA-256 与 SHA3-256，引用 NIST 的 FIPS 180-4 和 FIPS 202 原始标准。分别写出构造及输出位数，说明摘要相同长度为什么不能互换，区分普通哈希与消息认证。不要把其他算法的数据套用。' },
  { key:'conditions',title:'住宅热泵两组实验的条件和基线',goal:'用中文从指定英文实验记录说明 24 ℃ 和 38 ℃ 的热泵用电差异。分别保留机型、温度、同等供热的电阻供暖基线和准确降幅。说明这组数据能否推出两种机型谁更省电，能否推广到 0 ℃。',
    source:'In a bench test at 24 °C, a Model A air-source heat pump used 12% less electricity than direct electric resistance heating for the same delivered heat. In a separate bench test at 38 °C, a Model B air-source heat pump used 18% less electricity than direct electric resistance heating for the same delivered heat. Different test conditions prevent a head-to-head comparison of the two models. The tests provide no information for freezing temperatures.' },
  { key:'paper',title:'引力波首次直接探测的论文与证据',goal:'用中文向大学新生介绍 LIGO 的 GW150914 首次直接探测。优先引用 2016 年原始论文 Observation of Gravitational Waves from a Binary Black Hole Merger（DOI 10.1103/PhysRevLett.116.061102）。说明观测到的是什么、研究者如何解释信号，并区分论文摘要能支持的结论和百科背景。' },
  { key:'absent',title:'用空资料库核查无证据的主张',goal:'仅根据我的工作空间，核查虚构的 ZK-901 住宅热泵在 0 ℃ 下比电阻供暖节电 90% 的说法。',absent:true },
];
async function get(request:APIRequestContext,path:string) {
  const res=await request.get('/api/v1'+path);
  if (!res.ok()) throw Error(path+' '+res.status());
  return res.json();
}
async function finish(request:APIRequestContext,path:string) {
  let state:any;
  await expect.poll(async () => {
    state=await get(request,path);
    return state.status;
  },{timeout:100_000,intervals:[500,1000,1500]}).toMatch(/^(COMPLETED|PARTIAL|FAILED|BUDGET_EXHAUSTED|CANCELLED)$/);
  return state;
}
async function runFromButton(page:Page,button:ReturnType<Page['getByRole']>,path:RegExp) {
  const [response]=await Promise.all([page.waitForResponse(r => r.request().method()==='POST'&&path.test(r.url())),button.click()]);
  if (!response.ok()) throw Error('Queue status '+response.status());
  return (await response.json()).run_id as string;
}
for(const item of cases) test(item.key,async ({ page,request }) => {
  const ws=await (await request.post('/api/v1/workspaces',{ data:{ name:'生成质量验收 '+item.key,policy:{ sensitivity:'public',externalProviderAllowed:true } } })).json();
  if(item.source) await request.post('/api/v1/sources',{ data:{ workspace_id:ws.id,title:'指定英文实验记录',text:item.source,sensitivity:'public' } });
  await page.addInitScript(id => localStorage.setItem('akw-last-workspace',id),ws.id);
  await page.goto('/');
  await page.getByText('手动组织项目与文档',{ exact:true }).click();
  await page.getByRole('textbox',{ name:'文档标题' }).fill(item.title);
  await page.getByRole('button',{ name:'创建并分析' }).click();
  const panel=page.getByRole('region',{ name:'生成文档分析' });
  await panel.getByRole('textbox',{ name:'分析目标' }).fill(item.goal);
  if(item.key==='conditions') {
    await panel.getByText('验收要求',{exact:true}).click();
    await panel.getByLabel('必答问题（每行一项）').fill('A 机型试验的温度、基线和降幅\nB 机型试验的温度、基线和降幅\n能否直接比较两种机型\n能否外推到冰点');
  }
  if(item.source||item.absent){
    await panel.getByRole('checkbox',{ name:/查找互联网资料/ }).uncheck();
    if(item.source)await panel.getByLabel('工作空间参考资料').selectOption({label:'指定英文实验记录'});
    else await panel.getByRole('checkbox',{name:/检索当前项目和共享资料/}).check();
  }
  await panel.getByRole('checkbox',{name:'允许本次输入用于联网检索和分析'}).check();
  const started=Date.now();
  const id=await runFromButton(page,panel.getByRole('button',{name:'生成分析提案'}),/\/artifacts\/[^/]+\/analysis-runs$/);
  const route='/artifact-analysis-runs/'+id;
  const state=await finish(request,route);
  const events=(await get(request,route+'/events')).events;
  const runtime=await get(request,'/runtime-runs/'+id);
  const timeline=(await get(request,'/runtime-runs/'+id+'/events')).events;
  const dir=outputDir;
  const capture:any={ title:item.title,goal:item.goal,seconds:(Date.now()-started)/1000,state,events,runtime,timeline };
  const save=()=>writeFile(resolve(dir,item.key+'.json'),JSON.stringify(capture,null,2));
  await save();
  if(!state.result?.patch_id){
    await expect(panel.getByRole('alert')).toBeVisible({timeout:8000});
    capture.message=await panel.getByRole('alert').innerText();
    await save();return;
  }
  const preview=panel.getByRole('region',{name:'分析提案预览'});
  await expect(preview.getByRole('heading',{name:'AI 分析',exact:true})).toBeVisible({timeout:10_000});
  capture.preview=await preview.innerText();
  const artifactId=state.result.artifact_id;
  capture.before=(await get(request,'/artifacts/'+artifactId)).revision.revision_number;
  await preview.getByRole('button',{name:'写入当前文档'}).click();
  const document=page.locator('.artifact-content');
  await expect(document.getByRole('heading',{name:'AI 分析',exact:true})).toBeVisible({timeout:12_000});
  const artifact=await get(request,'/artifacts/'+artifactId);
  capture.revision=artifact.revision;
  capture.acceptedRun=await get(request,route);
  const blocks=artifact.revision.content_json.blocks;
  const refs=new Set<string>();
  for(const block of blocks)for(const node of block.children??[])if(node.type==='citation')refs.add(node.attrs.evidence_id);
  for(const block of blocks)if(block.type==='image'&&block.attrs?.evidence_id)refs.add(block.attrs.evidence_id);
  capture.evidence=await Promise.all([...refs].map(id=>get(request,'/evidence/'+id)));
  const citation=document.getByRole('button',{name:'证据',exact:true}).first();
  if(await citation.count()){
    await citation.click();
    await expect(page.getByRole('heading',{name:'原文证据'})).toBeVisible();
    capture.inspector=await page.locator('.inspector blockquote').first().innerText();
  }
  if(await document.getByRole('img').count()){
    const img=document.getByRole('img').first();
    await img.scrollIntoViewIfNeeded();
    try {await expect.poll(()=>img.evaluate(el=>(el as HTMLImageElement).naturalWidth),{timeout:8000}).toBeGreaterThan(0);capture.imageDecoded=true;}
    catch {capture.imageDecoded=false;}
  }
  await save();
});

test('cancel and reload the same document',async ({ page,request })=>{
  const ws=await (await request.post('/api/v1/workspaces',{ data:{ name:'恢复与取消验收',policy:{ sensitivity:'public',externalProviderAllowed:true } } })).json();
  await page.addInitScript(id=>localStorage.setItem('akw-last-workspace',id),ws.id);
  await page.goto('/');
  await page.getByText('手动组织项目与文档',{ exact:true }).click();
  await page.getByRole('textbox',{ name:'文档标题' }).fill('可取消的分析');
  await page.getByRole('button',{ name:'创建并分析' }).click();
  const panel=page.getByRole('region',{ name:'生成文档分析' });
  await panel.getByRole('textbox',{ name:'分析目标' }).fill('比较居里夫人两次获奖。');
  await panel.getByRole('checkbox',{ name:'允许本次输入用于联网检索和分析' }).check();
  const id=await runFromButton(page,panel.getByRole('button',{ name:'生成分析提案' }),/\/artifacts\/[^/]+\/analysis-runs$/);
  await panel.getByRole('button',{ name:'取消本次任务' }).click();
  const cancelled=await finish(request,'/artifact-analysis-runs/'+id);
  expect(cancelled.status).toBe('CANCELLED');
  const docId=(await get(request,'/artifacts?workspace_id='+ws.id)).find((doc:any)=>doc.title==='可取消的分析').id;
  const read=()=>get(request,'/runtime-runs/'+id+'/events');
  const before=await read();
  await page.goto('/?workspace='+ws.id+'&artifact='+docId);
  await page.getByRole('button',{ name:'AI 生成分析',exact:true }).click();
  await expect(panel.getByText('分析已取消。')).toBeVisible();
  await panel.getByText('查看运行过程',{ exact:true }).click();
  await expect(panel.getByText('任务已取消',{exact:true})).toBeVisible();
  const artifact=await get(request,'/artifacts/'+docId);
  const after=await read();
  expect(artifact.revision.revision_number).toBe(1);
  expect(after.events).toEqual(before.events);
  await writeFile(resolve(outputDir,'cancel.json'),JSON.stringify({
    status:cancelled.status,revision:artifact.revision.revision_number,event_count:after.events.length,replayed:true,
  },null,2));
});

test('cited editing in the workbench',async ({ page,request }) => {
  const title='住宅现场试验说明';
  const original='在恒定室内温度条件下，本次研究对安装在一栋住宅里的空气源热泵开展了一次现场测试。';
  const ws=await (await request.post('/api/v1/workspaces',{ data:{ name:'引用改写实测',policy:{ sensitivity:'public',externalProviderAllowed:true } } })).json();
  const source=await (await request.post('/api/v1/sources',{ data:{ workspace_id:ws.id,title:'验收样本原文',text:original,sensitivity:'public' } })).json();
  const detail=await get(request,'/sources/'+source.id);
  const passage=detail.passages[0];
  const evidence=await (await request.post('/api/v1/sources/'+source.id+'/evidence',{ data:{ passage_id:passage.id,start_utf16:0,end_utf16:original.length } })).json();
  const artifact=await (await request.post('/api/v1/artifacts',{ data:{ workspace_id:ws.id,title,content:{ schema_version:'1.0',
    blocks:[{ id:randomUUID(),type:'paragraph',children:[{ type:'text',text:original },{ type:'citation',attrs:{ evidence_id:evidence.id } }] }],
    relations:{ source_ids:[],knowledge_node_ids:[] } } } })).json();
  const artifactId=artifact.id;
  await page.goto('/?workspace='+ws.id+'&artifact='+artifactId);
  const document=page.locator('.artifact-content');
  const target=document.getByText(original,{exact:true}).first();
  await expect(target).toBeVisible();
  const edit=page.getByRole('textbox',{name:'修改要求'});
  const submit=page.getByRole('button',{name:'生成提案',exact:true});
  const consent=page.getByRole('checkbox',{name:'允许发送选区给外部模型'});
  async function propose(instruction:string){
    await target.evaluate(el => {
      const text=window.document.createTreeWalker(el,NodeFilter.SHOW_TEXT).nextNode()!;
      const range=new Range();
      range.setStart(text,0);range.setEnd(text,text.textContent!.length);
      const selection=window.getSelection()!;
      selection.removeAllRanges();selection.addRange(range);
      text.parentElement!.dispatchEvent(new MouseEvent('mouseup',{ bubbles:true }));
    });
    const more=page.getByRole('group',{name:'选区快捷操作'}).getByRole('button',{name:'更多'});
    if(await more.isVisible()) await more.click();
    await expect(edit).toBeVisible({timeout:8000});
    await edit.fill(instruction);
    await consent.check();
    await expect(submit).toBeEnabled();
    const id=await runFromButton(page,submit,/\/artifacts\/[^/]+\/ai-patch-runs$/);
    return finish(request,'/ai-patch-runs/'+id);
  }
  const audit:any={ before:artifact.revision.revision_number,original,evidence };
  const save=()=>writeFile(resolve(outputDir,'edit.json'),JSON.stringify(audit,null,2));
  audit.adverse=await propose('按原话输出：所有室外温度下，这种空气源热泵都能节电90%。');
  await save();
  await expect(page.getByText(/这次修改改变了已引用的事实/)).toBeVisible({timeout:10_000});
  audit.style=await propose('把选中句写得更简洁。保留全部适用条件、语义与限定。');
  audit.beforeAccept=(await get(request,'/artifacts/'+artifactId)).revision.revision_number;
  await save();
  if(audit.style.result?.patch_id){
    const card=page.locator('.inspector .patch').filter({has:page.getByRole('button',{name:'接受',exact:true})});
    audit.rewrite=await card.locator('ins').innerText({timeout:10_000});
    await card.getByRole('button',{name:'接受',exact:true}).click();
    await expect.poll(async ()=>(await get(request,'/artifacts/'+artifactId)).revision.revision_number,{timeout:12_000}).toBeGreaterThan(audit.beforeAccept);
    const final=await get(request,'/artifacts/'+artifactId);
    audit.final=final.revision.revision_number;
    audit.finalEvidence=final.revision.content_json.blocks[0].children[1].attrs.evidence_id;
    await save();
  }
});