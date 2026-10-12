import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {ompSchema} from './omp-schema.mjs';import {oauthFixture,browser} from './oauth-fixture.mjs';
test('login routes: one session at a time, status until done, logout',async()=>{
 const tmp=await mkdtemp(path.join(os.tmpdir(),'pi-mcp-route-'));const f=await oauthFixture();
 await mkdir(path.join(tmp,'data/agent'),{recursive:true});ompSchema(path.join(tmp,'data/agent/agent.db'));
 await writeFile(path.join(tmp,'data/agent/mcp.json'),JSON.stringify({mcpServers:{aiti:{type:'http',url:f.url,enabled:false}}}));
 const server=spawn(process.execPath,[fileURLToPath(new URL('../server.mjs',import.meta.url))],{env:{...process.env,PI_DESK_PORT:'0',PI_DESK_DATA:path.join(tmp,'data')},stdio:['ignore','pipe','pipe']});
 try{
  const origin=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Server startup timed out')),15000);server.stdout.once('data',c=>{clearTimeout(t);resolve(String(c).trim().replace('Pi Desk ',''));});server.once('exit',c=>{clearTimeout(t);reject(Error('Server exit '+c));});});
  const cookie=(await fetch(origin)).headers.get('set-cookie').split(';')[0];
  const api=async(route,body)=>{const r=await fetch(origin+'/api/'+route,{method:body?'POST':'GET',headers:{cookie,...(body?{'Content-Type':'application/json','X-Pi-Desk':'1',Origin:origin}:{})},body:body?JSON.stringify(body):undefined});const j=await r.json();if(!r.ok)throw Error(j.error);return j;};
  const first=await api('capabilities/mcp-login',{name:'aiti'});const again=await api('capabilities/mcp-login',{name:'aiti'});
  assert.equal(again.id,first.id);assert.equal(again.url,first.url);assert.match(first.url,/\/authorize\?/);
  assert.equal((await api('capabilities/mcp-login-status',{id:first.id})).state,'waiting');
  await browser(first.url);let st;for(let i=0;i<50;i++){st=await api('capabilities/mcp-login-status',{id:first.id});if(st.state!=='waiting')break;await new Promise(r=>setTimeout(r,100));}
  assert.equal(st.state,'done');assert.equal((await api('capabilities')).servers[0].login,'signed-in');
  const second=await api('capabilities/mcp-login',{name:'aiti'});assert.notEqual(second.id,first.id);await api('capabilities/mcp-login-cancel',{id:second.id});assert.equal((await api('capabilities/mcp-login-status',{id:second.id})).state,'cancelled');
  for(let i=0;i<50;i++){st=await api('capabilities/mcp-login-status',{id:second.id});if(st.state!=='waiting')break;await new Promise(r=>setTimeout(r,100));}assert.equal(st.state,'cancelled');
  assert.equal((await api('capabilities/mcp-logout',{name:'aiti'})).servers[0].login,'none');
 }finally{await new Promise(r=>{if(server.exitCode!==null)return r();server.once('exit',r);server.kill('SIGTERM');});await f.close();await rm(tmp,{recursive:true,force:true});}
});
