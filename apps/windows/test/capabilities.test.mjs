import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,stat,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {Capabilities,mcpConfig,remoteTarget} from '../capabilities.mjs';
test('skills explicitly activate, persist, and preserve originals on removal',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pi-skill-unit-'));try{
 const source=path.join(root,'source');await mkdir(source);await writeFile(path.join(source,'SKILL.md'),'---\nname: proof\ndescription: Fixture\n---\nSkill instructions.');
 const c=new Capabilities(root);await c.init();const [s]=await c.addSkill(source);assert.equal(s.enabled,false);assert.equal((await c.skillPolicy()).enabled,false);
 await assert.rejects(c.addSkill(source),/bereits/);await c.setSkill(s.id,true);assert.deepEqual((await c.skillPolicy()).includeSkills,['proof']);
 const again=new Capabilities(root);await again.init();assert.equal((await again.skills())[0].enabled,true);
 await writeFile(path.join(source,'SKILL.md'),'---\nname: changed\ndescription: Fixture\n---\nChanged');assert.equal((await again.skillPolicy()).enabled,false);
 await again.setSkill(s.id,false,true);assert.match(await readFile(path.join(source,'SKILL.md'),'utf8'),/Changed/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('MCP secrets stay private, changed targets require explicit secrets, other configuration survives',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pi-mcp-unit-'));try{
 await mkdir(path.join(root,'agent'));const c=new Capabilities(root);await c.init();
 await writeFile(c.mcpFile,JSON.stringify({mcpServers:{external:{command:'external',enabled:false}},extra:'keep'}));
 await c.saveServer({name:'fixture',config:{type:'http',url:'http://localhost:123/mcp',headers:{Authorization:'fixture-secret'},enabled:false}});
 assert.ok(!JSON.stringify(await c.servers()).includes('fixture-secret'));
 await c.saveServer({name:'fixture',edit:true,config:{type:'http',url:'http://localhost:123/mcp',enabled:true}});
 assert.equal((await c.mcpDocument()).mcpServers.fixture.headers.Authorization,'fixture-secret');
 await assert.rejects(c.saveServer({name:'fixture',edit:true,config:{type:'http',url:'http://localhost:456/mcp'}}),/Ziel geändert/);
 await c.setServer('fixture',false);assert.ok((await c.mcpDocument()).disabledServers.includes('fixture'));
 await c.setServer('fixture',false,true);const doc=await c.mcpDocument();assert.ok(doc.mcpServers.external);assert.equal(doc.extra,'keep');if(process.platform!=='win32')assert.equal((await stat(c.mcpFile)).mode&0o777,0o600);
 assert.throws(()=>mcpConfig({type:'stdio',command:'node',args:'invalid'}),/Argumente/);
 }finally{await rm(root,{recursive:true,force:true});}
});
import {DatabaseSync} from 'node:sqlite';import {McpCredentials} from '../mcp-credentials.mjs';import {ompSchema} from './omp-schema.mjs';import {oauthFixture,browser} from './oauth-fixture.mjs';
test('advanced login settings are validated, kept private and survive edits',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pi-mcp-oauth-'));try{
 await mkdir(path.join(root,'agent'));const c=new Capabilities(root);await c.init();
 await c.saveServer({name:'app',config:{type:'http',url:'https://example.com/mcp',oauth:{clientId:'id1',clientSecret:'geheim',scope:'a b',callbackPort:'53682'}}});
 assert.deepEqual((await c.mcpDocument()).mcpServers.app.oauth,{clientId:'id1',scope:'a b',callbackPort:53682,clientSecret:'geheim'});
 const [s]=await c.servers();assert.deepEqual(s.oauth,{clientId:'id1',scope:'a b',callbackPort:53682,hasClientSecret:true});assert.ok(!JSON.stringify(s).includes('geheim'));assert.equal(s.login,'none');
 await c.saveServer({name:'app',edit:true,config:{type:'http',url:'https://example.com/mcp',oauth:{clientId:'id1'}}});assert.equal((await c.mcpDocument()).mcpServers.app.oauth.clientSecret,'geheim');
 await c.saveServer({name:'app',edit:true,config:{type:'http',url:'https://example.com/mcp',oauth:{clientId:'id1',clearSecret:true}}});assert.equal((await c.mcpDocument()).mcpServers.app.oauth.clientSecret,undefined);
 assert.throws(()=>mcpConfig({type:'http',url:'https://example.com/mcp',oauth:{callbackPort:80}}),/1024 und 65535/);
 assert.throws(()=>mcpConfig({type:'http',url:'https://example.com/mcp',oauth:{clientId:'a\nb'}}),/Client-ID/);
 assert.throws(()=>mcpConfig({type:'http',url:'https://other.example/mcp',oauth:{}},{type:'http',url:'https://example.com/mcp',oauth:{clientSecret:'x'}}),/Client-Geheimnis neu eingeben/);
 assert.equal(mcpConfig({type:'http',url:'https://example.com/mcp',oauth:{}}).oauth,undefined);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('login stores the credential under the normalized URL; logout, URL change and removal delete it',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pi-mcp-login-'));const f=await oauthFixture();try{
 await mkdir(path.join(root,'agent'));ompSchema(path.join(root,'agent/agent.db'));const c=new Capabilities(root);await c.init();
 await c.saveServer({name:'aiti',config:{type:'http',url:f.url.replace('http://','HTTP://')}});
 const stored=(await c.mcpDocument()).mcpServers.aiti.url;assert.equal(stored,f.url);
 const servers=await c.login('aiti',{onUrl:u=>{browser(u);}});assert.equal(servers[0].login,'signed-in');assert.equal(c.credentials.status(stored),'signed-in');
 await c.logout('aiti');assert.equal(c.credentials.status(stored),'none');
 await c.login('aiti',{onUrl:u=>{browser(u);}});await c.saveServer({name:'aiti',edit:true,config:{type:'http',url:f.base+'/anders'}});assert.equal(c.credentials.status(stored),'none');
 await c.saveServer({name:'aiti',edit:true,config:{type:'http',url:stored}});await c.login('aiti',{onUrl:u=>{browser(u);}});await c.setServer('aiti',false,true);assert.equal(c.credentials.status(stored),'none');
 await c.saveServer({name:'local',config:{type:'stdio',command:'node',args:[]}});await assert.rejects(c.login('local'),/nur für HTTP- und SSE-Server/);assert.equal((await c.servers())[0].login,undefined);
 }finally{await f.close();await rm(root,{recursive:true,force:true});}
});
test('mcp-remote is recognized and converted to HTTP with headers',async()=>{
 assert.deepEqual(remoteTarget({command:'npx',args:['-y','mcp-remote','https://example.com/mcp']}),{url:'https://example.com/mcp',headers:{},dropped:[]});
 assert.deepEqual(remoteTarget({command:'C:\\Program Files\\nodejs\\npx.cmd',args:['mcp-remote@0.1.29','https://example.com/mcp','--header','X-Key: k','--transport','http-only']}),{url:'https://example.com/mcp',headers:{'X-Key':'k'},dropped:['--transport','http-only']});
 assert.deepEqual(remoteTarget({command:'/usr/local/bin/mcp-remote',args:['https://example.com/mcp']}),{url:'https://example.com/mcp',headers:{},dropped:[]});
 assert.equal(remoteTarget({command:'pnpm',args:['mcp-remote','https://example.com/mcp']}),null);
 assert.ok(remoteTarget({command:'pnpm',args:['dlx','mcp-remote','https://example.com/mcp']}));
 assert.equal(remoteTarget({command:'npx',args:['-y','@other/server','https://example.com/mcp']}),null);
 assert.equal(remoteTarget({type:'http',url:'https://example.com/mcp'}),null);
 const root=await mkdtemp(path.join(os.tmpdir(),'pi-mcp-remote-'));try{
 await mkdir(path.join(root,'agent'));const c=new Capabilities(root);await c.init();
 await writeFile(c.mcpFile,JSON.stringify({mcpServers:{aiti:{type:'stdio',command:'npx',args:['-y','mcp-remote','https://example.com/mcp','--header','X-Team: blau'],env:{A:'1'},enabled:true}}}));
 assert.deepEqual((await c.servers())[0].remote,{url:'https://example.com/mcp',dropped:[]});
 const [s]=await c.convertRemote('aiti');assert.equal(s.type,'http');assert.equal(s.url,'https://example.com/mcp');assert.equal(s.enabled,true);assert.equal(s.login,'none');assert.equal(s.remote,null);
 const saved=(await c.mcpDocument()).mcpServers.aiti;assert.deepEqual(saved.headers,{'X-Team':'blau'});assert.deepEqual(saved.env,{A:'1'});
 await assert.rejects(c.convertRemote('aiti'),/kein mcp-remote/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('unmanaged OMP oauth fields survive edits of an unchanged target',async()=>{
 const old={type:'http',url:'https://example.com/mcp',oauth:{clientId:'alt',redirectUri:'http://127.0.0.1:1/cb',callbackPath:'/cb',prompt:'consent',clientSecret:'s'}};
 const kept=mcpConfig({type:'http',url:'https://example.com/mcp',oauth:{clientId:'neu'}},old).oauth;
 assert.deepEqual(kept,{clientId:'neu',redirectUri:'http://127.0.0.1:1/cb',callbackPath:'/cb',prompt:'consent',clientSecret:'s'});
 assert.deepEqual(mcpConfig({type:'http',url:'https://example.com/mcp',oauth:{clearSecret:true}},old).oauth,{redirectUri:'http://127.0.0.1:1/cb',callbackPath:'/cb',prompt:'consent'});
 assert.equal(mcpConfig({type:'http',url:'https://example.com/mcp'},old).oauth,old.oauth);
 assert.deepEqual(mcpConfig({type:'http',url:'https://other.example/mcp',oauth:{clientId:'x',clearSecret:true}},old).oauth,{clientId:'x'});
});
test('a server edit with the same URL clears the required state, credentials stay',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pi-mcp-req-'));try{
 await mkdir(path.join(root,'agent'));const c=new Capabilities(root);await c.init();const url='https://example.com/mcp';
 await c.saveServer({name:'app',config:{type:'http',url}});c.authRequired.add(url);assert.equal((await c.servers())[0].login,'required');
 await c.saveServer({name:'app',edit:true,config:{type:'http',url,headers:{A:'b'}}});assert.equal((await c.servers())[0].login,'none');
 const other='https://example.com/neu';c.authRequired.add(other);await c.saveServer({name:'app',edit:true,config:{type:'http',url:other,headers:{A:'b'}}});assert.equal((await c.servers())[0].login,'none');assert.ok(!c.authRequired.has(url));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('adoptRefreshed copies a rotated credential from the probe copy back, but only when it changed',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pi-mcp-sync-'));try{
 const url='https://example.com/mcp',cred={access:'a',refresh:'r1'};await mkdir(path.join(root,'agent'));await mkdir(path.join(root,'probe'));
 ompSchema(path.join(root,'agent/agent.db'));const c=new Capabilities(root);await c.init();c.credentials.save(url,cred);
 const before=c.credentials.active(url);assert.ok(c.credentials.snapshot(path.join(root,'probe'),url));
 c.adoptRefreshed(url,path.join(root,'probe'),before);assert.deepEqual(JSON.parse(c.credentials.active(url)),cred);
 new McpCredentials(path.join(root,'probe')).save(url,{access:'b',refresh:'r2'});
 c.adoptRefreshed(url,path.join(root,'probe'),before);assert.deepEqual(JSON.parse(c.credentials.active(url)),{access:'b',refresh:'r2'});
 c.adoptRefreshed(url,path.join(root,'nichtda'),c.credentials.active(url));c.adoptRefreshed(url,path.join(root,'probe'),null);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('remoteTarget keeps an Authorization header out of headers and reports it as dropped',()=>{
 assert.deepEqual(remoteTarget({command:'npx',args:['-y','mcp-remote','https://example.com/mcp','--header','Authorization: Bearer x','--header','X-Key: k']}),{url:'https://example.com/mcp',headers:{'X-Key':'k'},dropped:['--header','Authorization: Bearer x']});
 assert.deepEqual(remoteTarget({command:'npx',args:['-y','mcp-remote','https://example.com/mcp','--header','authorization:${AUTH}','--header','X-Key: k']}),{url:'https://example.com/mcp',headers:{'X-Key':'k'},dropped:['--header','authorization:${AUTH}']});
});
test('an own Authorization header or a non-oauth auth block blocks the login',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pi-mcp-block-'));try{
 await mkdir(path.join(root,'agent'));const c=new Capabilities(root);await c.init();
 await writeFile(c.mcpFile,JSON.stringify({mcpServers:{hdr:{type:'http',url:'https://example.com/a',headers:{authorization:'Bearer x'}},key:{type:'sse',url:'https://example.com/b',auth:{type:'apikey',credentialId:'x'}},ok:{type:'http',url:'https://example.com/c',headers:{'X-Key':'k'},auth:{type:'oauth'}},cli:{command:'node',args:[]}}}));
 const by=Object.fromEntries((await c.servers()).map(s=>[s.name,s]));assert.equal(by.hdr.login,'blocked');assert.equal(by.key.login,'blocked');assert.equal(by.ok.login,'none');assert.equal(by.cli.login,undefined);
 await assert.rejects(c.login('hdr'),/eigenen Authorization-Header oder eine andere Anmeldeart/);await assert.rejects(c.login('key'),/Entferne ihn unter „Header und Umgebungsvariablen“/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('a revoked login (authRequired) is shown as required although a credential is saved',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pi-mcp-revoked-'));try{
 await mkdir(path.join(root,'agent'));ompSchema(path.join(root,'agent/agent.db'));const c=new Capabilities(root);await c.init();const url='https://example.com/mcp';
 await c.saveServer({name:'app',config:{type:'http',url}});c.credentials.save(url,{access:'a',refresh:'r'});assert.equal((await c.servers())[0].login,'signed-in');
 c.authRequired.add(url);assert.equal((await c.servers())[0].login,'required');
 const db=new DatabaseSync(path.join(root,'agent/agent.db'));db.exec("UPDATE auth_credentials SET disabled_cause='refresh failed'");db.close();assert.equal((await c.servers())[0].login,'expired');
 }finally{await rm(root,{recursive:true,force:true});}
});
