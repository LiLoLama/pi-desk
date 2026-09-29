// Full settings -> real OMP -> deterministic local model -> approval -> file flow.
import http from 'node:http';import {spawn} from 'node:child_process';import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
const root=await mkdtemp(path.join(os.tmpdir(),'pi-settings-e2e-')),project=path.join(root,'project');await mkdir(project);
let host,origin,systemPrompt='';const token='settings-test-only';
const model=http.createServer(async(req,res)=>{
 if(req.url==='/v1/models'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:'fixture',object:'model'}]}));return;}
 if(req.url==='/api/tags'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({models:[{name:'fixture'}]}));return;}
 if(req.method!=='POST'){res.writeHead(404);res.end();return;}
 let raw='';for await(const c of req)raw+=c;const input=JSON.parse(raw);systemPrompt=JSON.stringify(input.messages);
 const done=input.messages?.some(m=>m.role==='tool');const write=input.tools?.find(t=>t.function?.name==='write');
 res.writeHead(200,{'Content-Type':'text/event-stream'});
 const send=(delta,finish_reason=null)=>res.write('data: '+JSON.stringify({id:'test',object:'chat.completion.chunk',created:1,model:'fixture',choices:[{index:0,delta,finish_reason}]})+'\n\n');
 if(write&&!done){send({role:'assistant',tool_calls:[{index:0,id:'write-proof',type:'function',function:{name:'write',arguments:JSON.stringify({path:path.join(project,'proof.txt'),content:'Settings model integration verified.'})}}]});send({},'tool_calls');}
 else {send({role:'assistant',content:'Local settings connection verified.'});send({},'stop');}
 res.end('data: [DONE]\n\n');
});await new Promise(r=>model.listen(0,'127.0.0.1',r));
async function start(){
 host=spawn(process.execPath,[fileURLToPath(new URL('../server.mjs',import.meta.url))],{env:{...process.env,PI_DESK_DATA:path.join(root,'data'),PI_DESK_PORT:'0',PI_DESK_NATIVE_TOKEN:token},stdio:['pipe','pipe','pipe']});
 let out='',err='';host.stderr.on('data',c=>err+=c);
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Host timeout '+err)),15000);host.stdout.on('data',c=>{out+=c;const m=out.match(/Pi Desk (http:\/\/127.0.0.1:\d+)/);if(m){origin=m[1];clearTimeout(timeout);resolve();}});host.once('exit',()=>{clearTimeout(timeout);reject(Error(err));});});
}
async function stop(){await new Promise(r=>{host.once('exit',r);host.stdin.end();});}
async function request(route,body){const res=await fetch(origin+'/api/'+route,{method:body?'POST':'GET',headers:{'X-Pi-Desk-Native':token,...(body?{'Content-Type':'application/json','X-Pi-Desk':'1',Origin:origin}:{})},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json()};}
async function api(route,body){const r=await request(route,body);assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
async function until(fn){const end=Date.now()+20000;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,80));}throw Error('Timed out');}
try{
 await start();const baseUrl=`http://127.0.0.1:${model.address().port}/v1`;
 for(const kind of ['ollama','lm-studio','openai']){const test=await api('settings/connection-test',{kind,name:kind,baseUrl});assert.deepEqual(test.models,['fixture']);}
 assert.equal((await request('settings/connection-test',{kind:'openai',name:'invalid',baseUrl:'http://127.0.0.1:1'})).status,400);
 const config=await api('settings/connection',{kind:'openai',name:'Fixture API',baseUrl,models:[]});const provider=config.connections[0].id;
 await api('settings/agent',{instructions:'PI_DESK_PERSONALIZATION_PROOF',thinking:'off',lsp:true,webSearch:true,memory:'off',autoCompaction:true,autoRetry:true});
 assert.equal((await api('settings')).lsp,true);
 assert.equal((await api('settings')).memory,'off');
 const p=await api('projects',{path:project}),task=await api('tasks',{projectId:p.id});
 const models=await api('models?taskId='+task.id);assert.ok(models.models.some(m=>m.provider===provider&&m.id==='fixture'));
 await api('model',{taskId:task.id,provider,modelId:'fixture'});
 await api('prompt',{taskId:task.id,message:'Write the proof file.',context:[]});
 const pending=await until(async()=>{const s=await api('session?taskId='+task.id);if(s.error)throw Error('Fixture session error: '+s.error);if(!s.busy&&s.messages.some(m=>m.role==='assistant'))throw Error('Unexpected fixture result: '+JSON.stringify(s.messages));return s.pending.find(p=>['confirm','select'].includes(p.method));});
 assert.equal((await request('settings/agent',{instructions:'must not replace',thinking:'off'})).status,400);
 assert.equal((await request('task-state',{taskId:task.id,action:'archive'})).status,400);
 await assert.rejects(readFile(path.join(project,'proof.txt')));
 await api('respond',{taskId:task.id,id:pending.id,...(pending.method==='confirm'?{confirmed:true}:{value:'Approve'})});
 await until(async()=>{const s=await api('session?taskId='+task.id);return !s.busy&&s.messages.some(m=>JSON.stringify(m).includes('Local settings connection verified.'));});
 assert.equal(await readFile(path.join(project,'proof.txt'),'utf8'),'Settings model integration verified.');assert.match(systemPrompt,/PI_DESK_PERSONALIZATION_PROOF/);
 await stop();await start();
 assert.equal((await api('settings')).connections[0].id,provider);assert.equal((await api('settings')).instructions,'PI_DESK_PERSONALIZATION_PROOF');
 assert.ok((await api('session?taskId='+task.id)).messages.some(m=>JSON.stringify(m).includes('Local settings connection verified.')));
 console.log('PASS: local discovery probes, saved provider -> real OMP -> approved write -> response, personal instructions, busy protection, persistence and session resume');
}finally{if(host&&host.exitCode===null)await stop();await new Promise(r=>model.close(r));await rm(root,{recursive:true,force:true});}
