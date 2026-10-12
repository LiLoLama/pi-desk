// Real OMP 18.4.10: reads Pi Desk's stored MCP login, loads tools with it and refreshes it. Run by hand: node test/mcp-oauth-smoke.mjs
import assert from 'node:assert/strict';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdtemp,mkdir,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';import {DatabaseSync} from 'node:sqlite';
import {Capabilities} from '../capabilities.mjs';import {credentialKey} from '../mcp-credentials.mjs';import {Rpc} from '../rpc.mjs';import {oauthFixture,browser} from './oauth-fixture.mjs';
const binary=process.env.PI_DESK_OMP||fileURLToPath(new URL('../runtime/omp',import.meta.url));const run=promisify(execFile);
const root=await mkdtemp(path.join(os.tmpdir(),'pi-mcp-oauth-smoke-'));const agent=path.join(root,'agent');await mkdir(agent);const f=await oauthFixture();
try{
 const boot=new Rpc(binary,['--mode','rpc-ui','--model=anthropic/claude-sonnet-4-5',`--cwd=${root}`,'--no-session','--no-title','--no-extensions','--no-skills','--no-rules','--no-lsp','--no-tools'],{...process.env,PI_CODING_AGENT_DIR:agent});await boot.start();await boot.request('get_state');await boot.close();
 const c=new Capabilities(root);await c.init();await c.saveServer({name:'aiti',config:{type:'http',url:f.url,enabled:true}});
 await assert.rejects(c.probe('aiti',binary,process.env),/Anmeldung erforderlich/);assert.equal((await c.servers())[0].login,'required');console.log('PASS: 401 → Anmeldung erforderlich');
 await c.login('aiti',{onUrl:u=>{browser(u);}});assert.equal((await c.servers())[0].login,'signed-in');
 const key=credentialKey(f.url);const token=async(...extra)=>(await run(binary,['token',key,...extra],{env:{...process.env,PI_CODING_AGENT_DIR:agent}})).stdout.trim();
 const expire=()=>{const d=new DatabaseSync(path.join(agent,'agent.db'));d.prepare("UPDATE auth_credentials SET data=json_set(data,'$.expires',1) WHERE provider=? AND disabled_cause IS NULL").run(key);d.close();};
 const active=()=>JSON.parse(c.credentials.active(f.url));const refreshGrants=()=>f.state.tokenRequests.filter(r=>r.grant_type==='refresh_token').length;
 const stored=JSON.parse(new DatabaseSync(path.join(agent,'agent.db')).prepare("SELECT data FROM auth_credentials WHERE provider=? AND disabled_cause IS NULL").get(key).data);
 assert.equal(await token(),stored.access);console.log('PASS: omp token liest die Anmeldung');
 const probe=await c.probe('aiti',binary,process.env);assert.deepEqual(probe.tools,['proof']);console.log('PASS: OMP lädt die Werkzeuge mit Bearer');
 // The probe runs on a copy of agent.db: OMP refreshes there, Pi Desk must adopt the rotated token into the real store.
 expire();const beforeProbe=active().access,grantsBefore=refreshGrants();
 assert.deepEqual((await c.probe('aiti',binary,process.env)).tools,['proof']);
 assert.equal(refreshGrants(),grantsBefore+1);assert.notEqual(active().access,beforeProbe);console.log('PASS: Verbindungstest übernimmt das erneuerte Token in den echten Speicher');
 expire();const beforeToken=active().access;
 const refreshed=await token();assert.notEqual(refreshed,beforeToken);assert.equal(f.state.tokenRequests.at(-1).grant_type,'refresh_token');
 assert.deepEqual((await c.probe('aiti',binary,process.env)).tools,['proof']);console.log('PASS: OMP erneuert über den Refresh-Token');
 await c.logout('aiti');await assert.rejects(token());console.log('PASS: Abmelden entfernt die Anmeldung');
}finally{await f.close();await rm(root,{recursive:true,force:true});}
