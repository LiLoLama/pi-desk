import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,stat,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import {parse} from 'yaml';
import {SettingsStore,validateConnection} from '../settings.mjs';

test('settings preserve existing models, redact secrets, validate changes and recover transactions',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pi-settings-'));try{
 await mkdir(path.join(root,'agent'));
 await writeFile(path.join(root,'agent/models.yml'),'# Keep my provider\nproviders:\n  external:\n    baseUrl: https://example.com/v1\n    api: openai-completions\n    apiKey: EXISTING_KEY\n');
 const store=new SettingsStore(root);await store.recover();
 const result=await store.saveConnection({kind:'openai',name:'Local',baseUrl:'http://127.0.0.1:4321/v1',models:['fixture'],apiKey:'fixture-secret'});
 const c=result.connections[0];assert.equal(c.hasApiKey,true);assert.equal(c.apiKey,undefined);
 assert.ok(!JSON.stringify(result).includes('fixture-secret'));
 const yaml=await readFile(store.models,'utf8');assert.match(yaml,/# Keep my provider/);assert.equal(parse(yaml).providers.external.apiKey,'EXISTING_KEY');
 if(process.platform!=='win32')assert.equal((await stat(store.file)).mode&0o777,0o600);
 await assert.rejects(store.saveConnection({...c,baseUrl:'http://127.0.0.1:4322/v1'}),/Schlüssel/);
 await store.saveConnection({...c,name:'Renamed'});assert.equal(store.state.connections[0].apiKey,'fixture-secret');
 await store.saveAgent({instructions:'Antworte knapp.',thinking:'high'});
 assert.equal(store.state.browser,false);
 assert.equal(store.state.lsp,true);
 assert.equal(store.state.memory,'off');
 await store.saveAgent({instructions:'Antworte knapp.',thinking:'high',browser:true,browserHeadless:false,browserCdpUrl:'http://127.0.0.1:9222',lsp:false,memory:'local',advisor:true,github:true,pty:true,steeringMode:'one-at-a-time',computer:true,prewalk:true});
 assert.equal(store.state.browser,true);assert.equal(store.state.browserHeadless,false);assert.equal(store.state.browserCdpUrl,'http://127.0.0.1:9222');
 assert.equal(store.state.lsp,false);assert.equal(store.state.memory,'local');assert.equal(store.state.advisor,true);assert.equal(store.state.github,true);assert.equal(store.state.pty,true);assert.equal(store.state.steeringMode,'one-at-a-time');assert.equal(store.state.computer,true);assert.equal(store.state.prewalk,true);
 await assert.rejects(store.saveAgent({instructions:'x',thinking:'auto',memory:'vault'}),/Memory/);
 await assert.rejects(store.saveAgent({instructions:'x',thinking:'auto',browserCdpUrl:'ws://127.0.0.1:9222'}),/HTTP/);
 const reopened=new SettingsStore(root);await reopened.recover();assert.equal(reopened.state.instructions,'Antworte knapp.');assert.equal(reopened.state.connections[0].name,'Renamed');assert.equal(reopened.state.browser,true);
 await reopened.removeConnection(c.id);assert.equal(parse(await readFile(store.models,'utf8')).providers.external.apiKey,'EXISTING_KEY');assert.equal(parse(await readFile(store.models,'utf8')).providers[c.id],undefined);
 const next={version:1,connections:[],instructions:'Recovered',thinking:'low'};
 await writeFile(path.join(root,'settings-transaction.json'),JSON.stringify({settings:next,models:'providers: {}\n'}));
 await reopened.recover();assert.equal(reopened.state.instructions,'Recovered');assert.equal(await readFile(reopened.instructions,'utf8'),'Recovered');
 for(const baseUrl of ['file:///tmp/x','http://user:pass@localhost','javascript:foo','https://example.com/?key=secret'])assert.throws(()=>validateConnection({name:'x',kind:'openai',baseUrl}),/Server-URL/);
 assert.throws(()=>validateConnection({name:'x',kind:'openai',baseUrl:'http://localhost',apiKey:'!touch /tmp/no'}),/API-Schlüssel/);
 await writeFile(store.models,'providers: [bad\n');await assert.rejects(reopened.saveAgent({instructions:'x',thinking:'auto'}),/YAML/);
 }finally{await rm(root,{recursive:true,force:true});}
});
