import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';
import {McpCredentials,credentialKey,StorageMismatch,MissingStore} from '../mcp-credentials.mjs';import {ompSchema} from './omp-schema.mjs';
const url='https://www.aitraining.institute/mcp';const credential={access:'a1',refresh:'r1',expires:1,tokenUrl:'https://x/token',clientId:'c',resource:url,authorizationUrl:'https://x/authorize'};
async function dir(version){const d=await mkdtemp(path.join(os.tmpdir(),'pi-cred-'));if(version!==null)ompSchema(path.join(d,'agent.db'),version);return d;}
const rows=d=>{const db=new DatabaseSync(path.join(d,'agent.db'));try{return db.prepare('SELECT provider,credential_type,data,disabled_cause FROM auth_credentials ORDER BY id').all();}finally{db.close();}};
test('the key matches OMP 18.4.10',()=>{assert.equal(credentialKey(url),'mcp_oauth:profile:default:'+url);});
test('save writes OMP rows and replaces the previous active one',async()=>{const d=await dir(8);try{
 const c=new McpCredentials(d);assert.equal(c.status(url),'none');c.save(url,credential);assert.equal(c.status(url),'signed-in');
 c.save(url,{...credential,access:'a2'});const r=rows(d);assert.equal(r.length,2);assert.equal(r[0].disabled_cause,'replaced by newer credential');assert.equal(r[1].disabled_cause,null);
 assert.equal(r[1].provider,credentialKey(url));assert.equal(r[1].credential_type,'oauth');assert.deepEqual(JSON.parse(r[1].data),{...credential,access:'a2'});
}finally{await rm(d,{recursive:true,force:true});}});
test('status is expired when OMP disabled every row, remove deletes all rows of the URL',async()=>{const d=await dir(8);try{
 const c=new McpCredentials(d);c.save(url,credential);c.save('https://other/mcp',credential);
 const db=new DatabaseSync(path.join(d,'agent.db'));db.prepare("UPDATE auth_credentials SET disabled_cause='refresh failed' WHERE provider=?").run(credentialKey(url));db.close();
 assert.equal(c.status(url),'expired');c.remove(url);assert.equal(c.status(url),'none');assert.equal(c.status('https://other/mcp'),'signed-in');
}finally{await rm(d,{recursive:true,force:true});}});
test('without agent.db status is none and nothing else breaks',async()=>{const d=await dir(null);try{const c=new McpCredentials(d);assert.equal(c.exists(),false);assert.equal(c.status(url),'none');c.remove(url);assert.equal(c.snapshot(d),false);}finally{await rm(d,{recursive:true,force:true});}});
test('another schema version is refused before writing',async()=>{const d=await dir(9);try{const c=new McpCredentials(d);assert.throws(()=>c.save(url,credential),StorageMismatch);assert.throws(()=>c.save(url,credential),/speichert Anmeldungen anders/);assert.equal(rows(d).length,0);}finally{await rm(d,{recursive:true,force:true});}});
test('snapshot copies the database for the connection test',async()=>{const d=await dir(8);const t=await mkdtemp(path.join(os.tmpdir(),'pi-snap-'));try{const c=new McpCredentials(d);c.save(url,credential);assert.equal(c.snapshot(t),true);assert.equal(new McpCredentials(t).status(url),'signed-in');}finally{await rm(d,{recursive:true,force:true});await rm(t,{recursive:true,force:true});}});
test('save without agent.db throws MissingStore and creates no file',async()=>{const d=await dir(null);try{const c=new McpCredentials(d);assert.throws(()=>c.save(url,credential),MissingStore);assert.equal(c.exists(),false);}finally{await rm(d,{recursive:true,force:true});}});
test('active returns the data of the active row, null otherwise and never throws',async()=>{const d=await dir(null);try{
 const c=new McpCredentials(d);assert.equal(c.active(url),null);
 ompSchema(path.join(d,'agent.db'),8);assert.equal(c.active(url),null);
 c.save(url,credential);assert.deepEqual(JSON.parse(c.active(url)),credential);assert.equal(c.active('https://other/mcp'),null);
 c.save(url,{...credential,refresh:'r2'});assert.equal(JSON.parse(c.active(url)).refresh,'r2');
 const db=new DatabaseSync(path.join(d,'agent.db'));db.prepare("UPDATE auth_credentials SET disabled_cause='refresh failed' WHERE provider=?").run(credentialKey(url));db.close();assert.equal(c.active(url),null);
}finally{await rm(d,{recursive:true,force:true});}});
