import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openMeteo } from '../src/runtime/weather-provider';
import { information } from '../src/runtime/information-retrieval';
import { planTask,weatherQuery } from '../src/runtime/task-routing';
import { AppError } from '../src/platform/errors';
import { openDatabase,migrate } from '../src/platform/database';
import { browseWeb,collectLinks } from '../src/domain/workspace-browsing';
import { services } from '../src/services';
import type { WeatherData } from '@akw/contracts';

const controller=new AbortController();
const at='2026-11-14T06:00:00.000Z';
const fixture:WeatherData={ version:1,place:{ name:'北京',area:'中国',latitude:39.9,longitude:116.4 },
  timezone:'Asia/Shanghai',captured_at:at,expires_at:'2026-11-14T06:10:00.000Z',window:{ offset:1,days:1 },current:null,
  hours:[{ time:'2026-11-15T12:00',temperature:7,precipitation:null }],
  days:[{ date:'2026-11-15',low:3,high:8,precipitation:30,code:0 }] };
const is=(code:string)=>(error:unknown)=>error instanceof AppError && error.code===code;
test('natural-language routing distinguishes learning, operations, facts and current forecasts',()=>{
  assert.equal(planTask('我想系统学习图神经网络')[0]?.capability,'learning');
  const learningGoal='我想系统学习图神经网络，并了解它在晶体材料物性预测中的应用。';
  assert.deepEqual(planTask(learningGoal),[{ capability:'learning',goal:learningGoal }]);
  assert.equal(planTask('Windows 11 如何截图？')[0]?.capability,'guide');
  assert.equal(planTask('北京明天会下雨吗？')[0]?.capability,'weather');
  assert.equal(planTask('降雨为什么会形成？')[0]?.capability,'information');
  assert.deepEqual(planTask('北京未来三天天气；然后打开网页 https://example.org').map(step=>step.capability),['weather','browse']);
  assert.deepEqual(planTask('北京未来三天天气，并告诉我 Windows 11 如何截图').map(step=>step.capability),['weather','guide']);
  assert.deepEqual(weatherQuery('北京未来三天天气'),{ city:'北京',offset:0,days:3 });
  assert.deepEqual(weatherQuery('北京明天会下雨吗？'),{ city:'北京',offset:1,days:1 });
  assert.deepEqual(weatherQuery('Springfield 明天天气','Springfield, Illinois, United States'),
    { city:'Springfield, Illinois, United States',offset:1,days:1 });
  assert.throws(()=>weatherQuery('这几天天气怎么样？'),is('WEATHER_PLACE_REQUIRED'));
  assert.throws(()=>weatherQuery('北京明天开始未来七天天气'),is('WEATHER_WINDOW_UNSUPPORTED'));
});

test('an information fallback retains topic-specific excerpts and drops superficially similar sources',async()=>{
  const useful={ kind:'paper',provider:'Crossref',title:'Graph Neural Networks',url:'https://doi.org/10.1234/gnn',
    text:'Graph neural networks aggregate information along edges for node classification and graph prediction.' } as const;
  const unrelated={ ...useful,title:'A graph of mineral supply chains',url:'https://doi.org/10.1234/minerals',
    text:'Global trade networks describe relations and dependencies between countries and companies. This article analyzes mineral supply and trade statistics.' };
  const result=await information('Model applications','information',controller.signal,{
    discover:{ discover:async()=>[unrelated,useful],image:async()=>{ throw new Error('Unused'); } },
    model:async prompt=>prompt==='information.plan' ? JSON.stringify({ title:'Graph models',chinese:'图神经网络',english:'graph neural networks',scope:'Examples' }) : '',
    allow:async rows=>rows,stage:async()=>{},
  });
  assert.ok(result.partial);
  assert.deepEqual(result.items.map(item=>item.title),[useful.title]);
});

test('weather adapter preserves unavailable values, local intervals and cache freshness',async()=>{
  const calls:URL[]=[];
  let time=new Date(at);
  const provider=openMeteo(async input=>{
    const url=new URL(String(input));calls.push(url);
    if (calls.length===2) return new Response(null,{ status:503 });
    return Response.json(url.hostname.startsWith('geocoding') ? { results:[{ name:'北京',latitude:39.9,longitude:116.4,country:'中国',population:21000000 }] } : {
      timezone:'Asia/Shanghai',
      hourly:{ time:['2026-11-14T12:00','2026-11-15T12:00'],temperature_2m:[3,7],precipitation_probability:[2,null] },
      daily:{ time:['2026-11-14','2026-11-15'],temperature_2m_max:[7,8],temperature_2m_min:[2,3],
        precipitation_probability_max:[10,30],weather_code:[1,0] },
    });
  },()=>time);
  const query={ city:'北京',offset:1,days:1 };
  const result=await provider(query,controller.signal);
  assert.equal(result.current,null);
  assert.equal(result.days[0]?.date,'2026-11-15');
  assert.equal(result.hours[0]?.precipitation,null);
  assert.equal(calls[1]?.searchParams.get('forecast_days'),'2');
  assert.equal(calls[2]?.href,calls[1]?.href);
  assert.equal((await provider(query,controller.signal)).captured_at,result.captured_at);
  assert.equal(calls.length,3);
  time=new Date('2026-11-14T06:01:00.000Z');
  assert.equal((await provider({ ...query,place:result.place },controller.signal)).captured_at,time.toISOString());
  assert.equal(calls.length,4);
});

test('interactive weather runs ahead of a queued research task and refreshes the same artifact',async t=>{
  const db=await openDatabase({});
  await migrate(db);
  t.after(()=>db.close());
  let lookups=0;
  const app=services(db,{ async put(){},async get(){ return Buffer.alloc(0); } },{
    weather:async query=>{
      lookups++;
      assert.equal(query.offset,1);
      return { ...fixture,captured_at:new Date(Date.parse(at)+lookups*1000).toISOString() };
    },
  });
  const actor={ tenant:'fixture-task',user:'editor' };
  const existing=await app.workspaces.create(actor,{ name:'Tasks',policy:{ sensitivity:'public',externalProviderAllowed:true } });
  const longer=await app.jobs.task(actor,{ workspace_id:existing.id,goal:'Explain graph models',allow_external:true });
  const input={ workspace_id:existing.id,goal:'北京明天天气',allow_external:true as const };
  const queued=await app.jobs.task(actor,input,'same-task-request');
  assert.equal((await app.jobs.task(actor,input,'same-task-request')).run_id,queued.run_id);
  assert.equal(await app.jobs.next(controller.signal,'interactive'),true);
  assert.equal((await app.jobs.getTask(actor,longer.run_id)).status,'QUEUED');
  const done=await app.jobs.getTask(actor,queued.run_id);
  assert.equal(done.status,'COMPLETED');
  const id=String(done.result?.artifact_id);
  const initial=await app.artifacts.get(actor,id);
  const refreshed=await app.jobs.refreshWeather(actor,id,{ base_revision_id:initial.revision.id,allow_external:true });
  assert.equal(await app.jobs.next(controller.signal,'interactive'),true);
  assert.equal((await app.jobs.getTask(actor,refreshed.run_id)).result?.artifact_id,id);
  const after=await app.artifacts.get(actor,id);
  assert.equal(after.revision.parent_revision_id,initial.revision.id);
  assert.equal(after.revision.content_json.blocks[0]?.id,initial.revision.content_json.blocks[0]?.id);
  assert.notDeepEqual(after.revision.content_json.blocks[0]?.children,initial.revision.content_json.blocks[0]?.children);
  await assert.rejects(app.jobs.refreshWeather(actor,id,{ base_revision_id:initial.revision.id,allow_external:true }),is('CONFLICT_ARTIFACT_VERSION'));
});

test('a composite task saves independent capabilities in a single version and preserves a missing part',async t=>{
  const db=await openDatabase({});
  await migrate(db);
  t.after(()=>db.close());
  const app=services(db,{ async put(){},async get(){ return Buffer.alloc(0); } },{ weather:async()=>fixture });
  const actor={ tenant:'composition-fixture',user:'editor' };
  const ws=await app.workspaces.create(actor,{ name:'Composite',policy:{ sensitivity:'public',externalProviderAllowed:true } });
  const goal='北京明天天气；打开网页 https://example.org/meeting；什么是未配置的来源';
  const task=await app.jobs.task(actor,{ workspace_id:ws.id,goal,allow_external:true });
  await app.jobs.next(controller.signal,'general');
  const run=await app.jobs.getTask(actor,task.run_id);
  assert.equal(run.status,'PARTIAL',JSON.stringify(run));
  assert.equal((await app.artifacts.list(actor,ws.id)).length,1);
  const artifact=await app.artifacts.get(actor,String(run.result?.artifact_id));
  assert.deepEqual(artifact.revision.content_json.blocks.map(block=>block.type),['weather_forecast','paragraph','task_gap','evidence_network']);
  assert.equal(artifact.revision.content_json.blocks[1]?.children?.[0]?.attrs?.url,'https://example.org/meeting');
  assert.equal(artifact.revision.content_json.blocks[2]?.attrs?.code,'INFORMATION_NO_EVIDENCE');
  assert.deepEqual((run.result?.gaps as {code:string}[]).map(gap=>gap.code),['INFORMATION_NO_EVIDENCE']);
});

test('browse returns original URLs without model generation and a selection can become an artifact',async t=>{
  const db=await openDatabase({});
  await migrate(db);
  t.after(()=>db.close());
  const app=services(db,{ async put(){},async get(){ return Buffer.alloc(0); } },{
    search:async()=>[{ title:'Official page',url:'https://example.org/page#intro' },{ title:'Same page',url:'https://example.org/page' }],
  });
  const actor={ tenant:'browse-fixture',user:'editor' };
  const ws=await app.workspaces.create(actor,{ name:'Browse',policy:{ sensitivity:'public',externalProviderAllowed:true } });
  const rows=await browseWeb(app,actor,{ workspace_id:ws.id,query:'catalog',allow_external:true },controller.signal);
  assert.deepEqual(rows.results.map(item=>item.url),['https://example.org/page']);
  assert.equal(rows.coverage,'web');
  const direct=await browseWeb(app,actor,{ workspace_id:ws.id,query:'https://example.org/spec',allow_external:true },controller.signal);
  assert.equal(direct.results[0]?.provider,'用户提供的链接');
  const input={ workspace_id:ws.id,title:'Collected links',items:rows.results.map(({ title,url })=>({ title,url })) };
  const artifact=await collectLinks(app,actor,input,'idempotent-capture');
  assert.equal((await collectLinks(app,actor,input,'idempotent-capture')).id,artifact.id);
  assert.equal(artifact.revision.content_json.blocks[0]?.children?.[0]?.attrs?.url,'https://example.org/page');
});
