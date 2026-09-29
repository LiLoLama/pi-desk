// Full settings -> real OMP -> deterministic local model -> approval -> file flow.
import http from 'node:http';import {spawn} from 'node:child_process';import {mkdtemp,mkdir,readFile,writeFile,chmod,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
const root=await mkdtemp(path.join(os.tmpdir(),'pi-local-host-')),project=path.join(root,'project');await mkdir(project);
let host,origin,systemPrompt='';const token='settings-test-only';
const runtimeRoot=path.join(root,'data/local-models');await mkdir(runtimeRoot+'/gguf',{recursive:true});await mkdir(runtimeRoot+'/models');
await writeFile(runtimeRoot+'/models/fixture.gguf','GGUF fixture');await writeFile(runtimeRoot+'/gguf.ready','test fixture');
await writeFile(runtimeRoot+'/gguf/llama-server', '#!'+process.execPath+'\n'+"import http from 'node:http';import path from 'node:path';const project="+JSON.stringify(project)+';\n'+"const model=http.createServer(async(req,res)=>{\n if(req.url==='/v1/models'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:'fixture',object:'model'}]}));return;}\n if(req.url==='/api/tags'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({models:[{name:'fixture'}]}));return;}\n if(req.method!=='POST'){res.writeHead(404);res.end();return;}\n let raw='';for await(const c of req)raw+=c;const input=JSON.parse(raw);\n const done=input.messages?.some(m=>m.role==='tool');const write=input.tools?.find(t=>t.function?.name==='write');\n res.writeHead(200,{'Content-Type':'text/event-stream'});\n const send=(delta,finish_reason=null)=>res.write('data: '+JSON.stringify({id:'test',object:'chat.completion.chunk',created:1,model:'fixture',choices:[{index:0,delta,finish_reason}]})+'\\n\\n');\n if(write&&!done){send({role:'assistant',tool_calls:[{index:0,id:'write-proof',type:'function',function:{name:'write',arguments:JSON.stringify({path:path.join(project,'proof.txt'),content:'Settings model integration verified.'})}}]});send({},'tool_calls');}\n else {send({role:'assistant',content:'Local settings connection verified.'});send({},'stop');}\n res.end('data: [DONE]\\n\\n');\n});model.listen(Number(process.argv[process.argv.indexOf('--port')+1]),'127.0.0.1');\n");await chmod(runtimeRoot+'/gguf/llama-server',0o700);
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
 await start();const library=await api('local-models');assert.equal(library.models.length,1);await api('local-models/start',{id:library.models[0].id});await until(async()=>{const s=await api('local-models');if(s.job?.error)throw Error(s.job.error);return !s.job?.running&&s.active?.state==='ready';});const provider='pi-desk-local';
 const p=await api('projects',{path:project}),task=await api('tasks',{projectId:p.id});
 const models=await api('models?taskId='+task.id);assert.ok(models.models.some(m=>m.provider===provider&&m.id==='local'));
 await api('model',{taskId:task.id,provider,modelId:'local'});
 await api('prompt',{taskId:task.id,message:'Write the proof file.',context:[]});
 const pending=await until(async()=>{const s=await api('session?taskId='+task.id);if(s.error)throw Error('Fixture session error: '+s.error);if(!s.busy&&s.messages.some(m=>m.role==='assistant'))throw Error('Unexpected fixture result: '+JSON.stringify(s.messages));return s.pending.find(p=>['confirm','select'].includes(p.method));});
 assert.equal((await request('local-models/stop',{})).status,400);
 assert.equal((await request('settings/agent',{instructions:'must not replace',thinking:'off'})).status,400);
 assert.equal((await request('task-state',{taskId:task.id,action:'archive'})).status,400);
 await assert.rejects(readFile(path.join(project,'proof.txt')));
 await api('respond',{taskId:task.id,id:pending.id,...(pending.method==='confirm'?{confirmed:true}:{value:'Approve'})});
 await until(async()=>{const s=await api('session?taskId='+task.id);return !s.busy&&s.messages.some(m=>JSON.stringify(m).includes('Local settings connection verified.'));});
 assert.equal(await readFile(path.join(project,'proof.txt'),'utf8'),'Settings model integration verified.');assert.equal((await request('local-models/stop',{})).status,200);
 await stop();await start();
 assert.ok(!(await api('settings')).connections.some(c=>c.managed));
 assert.ok((await api('session?taskId='+task.id)).messages.some(m=>JSON.stringify(m).includes('Local settings connection verified.')));
 console.log('PASS: managed local runtime -> real OMP -> approved tool -> streamed response; busy unload blocked; stop/start persistence');
}finally{if(host&&host.exitCode===null)await stop();await rm(root,{recursive:true,force:true});}
