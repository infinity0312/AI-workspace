import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const requireAudit=createRequire(resolve('.data/v2-harness-poc/package.json'));
const load=name=>import(pathToFileURL(requireAudit.resolve(name)).href);
const { Session,SessionId,SESSION_FORMAT_VERSION }=await load('@deepseek-ai/dsh-session');
const { createUserMessage,createMessage,createToolResultMessage,ToolCallId }=await load('@deepseek-ai/dsh-llm');
const { AgentLoop }=await load('@deepseek-ai/dsh-agent-loop');
assert.equal(typeof AgentLoop,'function');

const session=Session.create(SessionId('akw-protocol-poc'));
session.append('turn/start',{ turn:1 });
session.append('user/message',createUserMessage({ source:{ kind:'user' },content:[{ type:'text',text:'synthetic question' }] }),{ surfaceOp:'append' });
const callId=ToolCallId('synthetic-call');
session.append('assistant/message',{ turn:1,step:1,stream:[],message:createMessage({ role:'assistant',
  source:{ kind:'model',provider:'mock',model:'mock' },content:[{ type:'tool-call',id:callId,name:'fixture',arguments:'{}' }] }) },{ surfaceOp:'append' });
session.append('tool/result',{ turn:1,step:1,message:createToolResultMessage({ callId,
  content:[{ type:'text',text:'fixture result' }],isError:false }) },{ surfaceOp:'append' });
session.append('turn/end',{ turn:1,reason:{ kind:'completed' } });
const messages=session.deriveMessages();
assert.deepEqual(messages.map(message=>message.role),['user','assistant','tool']);
console.log(JSON.stringify({ session_format:SESSION_FORMAT_VERSION,derived_roles:messages.map(message=>message.role),agent_loop_imported:true,model_calls:0 }));
