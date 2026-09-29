import {spawn} from 'node:child_process';
import {mkdtemp,stat,rm} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
const data=await mkdtemp(path.join(os.tmpdir(),'pi-native-host-'));
const script=fileURLToPath(new URL('../server.mjs',import.meta.url));const token='native-test-session';let child;
try{
  child=spawn(process.execPath,[script],{env:{...process.env,PI_DESK_DATA:data,PI_DESK_PORT:'0',PI_DESK_NATIVE_TOKEN:token},stdio:['pipe','pipe','pipe']});
  const endpoint=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('startup timed out')),15000);child.stdout.once('data',d=>{clearTimeout(t);resolve(String(d).trim().replace('Pi Desk ',''));});child.once('error',reject);});
  assert.equal((await fetch(endpoint+'/api/state')).status,403);
  const response=await fetch(endpoint+'/api/state',{headers:{'X-Pi-Desk-Native':token}});assert.equal(response.status,200);assert.deepEqual((await response.json()).projects,[]);
  const second=spawn(process.execPath,[script],{env:{...process.env,PI_DESK_DATA:data,PI_DESK_PORT:'0'},stdio:'ignore'});
  assert.equal(await new Promise(resolve=>second.once('exit',resolve)),1);
  const exit=new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('helper did not shut down on EOF')),10000);child.once('exit',code=>{clearTimeout(t);resolve(code);});});child.stdin.end();assert.equal(await exit,0);await assert.rejects(stat(path.join(data,'engine.lock')));
  console.log('PASS: random port, native token protection, single engine, shutdown on native host EOF, lock cleanup');
}finally{if(child?.exitCode===null)child.kill();await rm(data,{recursive:true,force:true});}
