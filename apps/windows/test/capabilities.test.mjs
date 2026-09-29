import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,stat,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {Capabilities,mcpConfig} from '../capabilities.mjs';
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
 await c.setServer('fixture',false,true);const doc=await c.mcpDocument();assert.ok(doc.mcpServers.external);assert.equal(doc.extra,'keep');assert.equal((await stat(c.mcpFile)).mode&0o777,0o600);
 assert.throws(()=>mcpConfig({type:'stdio',command:'node',args:'invalid'}),/Argumente/);
 }finally{await rm(root,{recursive:true,force:true});}
});
