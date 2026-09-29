import {readFile,writeFile,rename,mkdir,realpath,stat,symlink,rm,mkdtemp} from 'node:fs/promises';
import path from 'node:path';import {randomUUID} from 'node:crypto';import {parse} from 'yaml';import {Rpc} from './rpc.mjs';
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
async function readJSON(file,fallback){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw Error('Konfigurationsdatei ist nicht lesbar: '+path.basename(file));}}
async function atomic(file,value){await writeFile(file+'.tmp',JSON.stringify(value,null,2),{mode:0o600});await rename(file+'.tmp',file);}
export async function skillInfo(source){
 const root=await realpath(source);if(!(await stat(root)).isDirectory())throw Error('Bitte den Ordner mit SKILL.md auswählen.');
 const file=path.join(root,'SKILL.md');if((await stat(file)).size>250000)throw Error('SKILL.md ist zu groß (maximal 250 KB).');
 const text=await readFile(file,'utf8');const match=text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);if(!match)throw Error('SKILL.md benötigt YAML-Frontmatter mit name und description.');
 let meta;try{meta=parse(match[1]);}catch{throw Error('Ungültiges YAML in SKILL.md.');}
 if(!object(meta)||typeof meta.name!=='string'||! /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(meta.name))throw Error('Skill-Name: 1–80 Buchstaben, Ziffern, Bindestriche oder Unterstriche.');
 if(typeof meta.description!=='string'||!meta.description.trim())throw Error('Dem Skill fehlt eine description.');
 if(meta.enabled===false)throw Error('Der Skill ist in SKILL.md mit enabled: false deaktiviert.');
 return {name:meta.name,description:meta.description.slice(0,2000),path:root,text};
}
function dictionary(raw,label){if(!object(raw)||Object.keys(raw).length>100||Object.entries(raw).some(([k,v])=>!k||typeof v!=='string'||v.length>16000))throw Error(label+' muss ein JSON-Objekt mit Textwerten sein.');return raw;}
export function mcpConfig(raw,old){
 if(!object(raw)||!['stdio','http','sse'].includes(raw.type))throw Error('MCP-Typ muss stdio, http oder sse sein.');
 let c={type:raw.type,enabled:raw.enabled===true,timeout:15000};
 if(raw.type==='stdio'){
  if(typeof raw.command!=='string'||!raw.command.trim()||raw.command.length>1024||/[\r\n\0]/.test(raw.command))throw Error('Ein ausführbares Programm angeben, Argumente separat.');
  if(!Array.isArray(raw.args)||raw.args.length>100||raw.args.some(a=>typeof a!=='string'||a.length>8192))throw Error('Argumente müssen eine JSON-Liste von Texten sein.');
  c.command=raw.command.trim();c.args=raw.args;
  if(raw.cwd){if(typeof raw.cwd!=='string'||!path.isAbsolute(raw.cwd))throw Error('Arbeitsordner muss ein absoluter Pfad sein.');c.cwd=raw.cwd;}
 }else{
  let u;try{u=new URL(raw.url);}catch{throw Error('Vollständige MCP-URL eingeben.');}
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.hash||u.search)throw Error('HTTP(S)-URL ohne Zugangsdaten oder Suchparameter verwenden; Schlüssel als Header hinterlegen.');
  c.url=u.toString();
 }
 const changed=old&&(old.type!==c.type||old.url!==c.url||old.command!==c.command||JSON.stringify(old.args??[])!==JSON.stringify(c.args??[])||old.cwd!==c.cwd);
 for(const key of ['env','headers']){
  if(raw[key]!==undefined)c[key]=dictionary(raw[key],key);
  else if(old?.[key]&&Object.keys(old[key]).length){if(changed)throw Error('Ziel geändert: gespeicherte '+key+' neu eingeben oder ausdrücklich entfernen.');c[key]=old[key];}
 }
 if(old&&!changed){for(const key of ['auth','oauth','requestIdFormat'])if(old[key]!==undefined)c[key]=old[key];}
 return c;
}
export class Capabilities {
 constructor(data){this.data=data;this.file=path.join(data,'capabilities.json');this.mcpFile=path.join(data,'agent/mcp.json');this.state={skills:[]};}
 async init(){this.state=await readJSON(this.file,{skills:[]});}
 async skills(){return Promise.all(this.state.skills.map(async s=>{try{const info=await skillInfo(s.path);if(info.name!==s.name)throw Error('Skill wurde umbenannt. Bitte neu verbinden.');return {...s,description:info.description};}catch(e){return {...s,error:e.message};}}));}
 async addSkill(source){
  const info=await skillInfo(source);if(this.state.skills.some(s=>s.name===info.name||s.path===info.path))throw Error('Dieser Skill ist bereits verbunden.');
  const s={id:randomUUID(),name:info.name,path:info.path,enabled:false};const folder=path.join(this.data,'skill-links',s.id);await mkdir(folder,{recursive:true,mode:0o700});await symlink(s.path,path.join(folder,s.name),'dir');
  const next={...this.state,skills:[...this.state.skills,s]};try{await atomic(this.file,next);this.state=next;}catch(e){await rm(folder,{recursive:true,force:true});throw e;}return this.skills();
 }
 async setSkill(id,enabled,remove=false){const s=this.state.skills.find(s=>s.id===id);if(!s)throw Error('Skill nicht gefunden.');if(enabled){const info=await skillInfo(s.path);if(info.name!==s.name)throw Error('Skill wurde umbenannt. Bitte neu verbinden.');}
 const next={...this.state,skills:remove?this.state.skills.filter(x=>x.id!==id):this.state.skills.map(x=>x.id===id?{...x,enabled:enabled===true}:x)};await atomic(this.file,next);this.state=next;
 if(remove)await rm(path.join(this.data,'skill-links',s.id),{recursive:true,force:true});return this.skills();}
 async preview(id){const s=this.state.skills.find(x=>x.id===id);if(!s)throw Error('Skill nicht gefunden.');return skillInfo(s.path);}
 async skillPolicy(){const active=(await this.skills()).filter(s=>s.enabled&&!s.error);return {enabled:!!active.length,enableSkillCommands:true,customDirectories:active.map(s=>path.join(this.data,'skill-links',s.id)),includeSkills:active.length?active.map(s=>s.name):['pi-desk-no-skills-selected'],enableCodexUser:false,enableClaudeUser:false,enableClaudeProject:false,enablePiUser:false,enablePiProject:false,enableAgentsUser:false,enableAgentsProject:false};}
 async mcpDocument(){const doc=await readJSON(this.mcpFile,{mcpServers:{}});if(!object(doc)||!object(doc.mcpServers))throw Error('mcp.json enthält keine gültige Server-Zuordnung.');return doc;}
 async servers(){const doc=await this.mcpDocument();return Object.entries(doc.mcpServers).map(([name,c])=>({name,type:c.type||'stdio',command:c.command||'',args:c.args||[],cwd:c.cwd||'',url:c.url||'',enabled:c.enabled!==false&&!(doc.disabledServers||[]).includes(name),envKeys:Object.keys(c.env||{}),headerKeys:Object.keys(c.headers||{}),hasOAuth:!!(c.oauth||c.auth)}));}
 async saveServer(raw){if(typeof raw.name!=='string'||! /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(raw.name))throw Error('Servername: Buchstaben, Ziffern, Bindestriche oder Unterstriche (maximal 64).');const doc=await this.mcpDocument();
 if(!raw.edit&&doc.mcpServers[raw.name])throw Error('Servername ist bereits vorhanden.');
 doc.mcpServers[raw.name]=mcpConfig(raw.config,doc.mcpServers[raw.name]);
 doc.disabledServers=(doc.disabledServers||[]).filter(x=>x!==raw.name);doc.enabledServers=(doc.enabledServers||[]).filter(x=>x!==raw.name);
 await atomic(this.mcpFile,doc);return this.servers();}
 async setServer(name,enabled,remove=false){const doc=await this.mcpDocument();if(!Object.hasOwn(doc.mcpServers,name))throw Error('MCP-Server nicht gefunden.');
 if(remove)delete doc.mcpServers[name];else doc.mcpServers[name].enabled=enabled===true;
 doc.disabledServers=(doc.disabledServers||[]).filter(x=>x!==name);doc.enabledServers=(doc.enabledServers||[]).filter(x=>x!==name);
 // Keep an explicit denylist when disabled, so inherited sources cannot reactivate it.
 if(!enabled&&!remove)doc.disabledServers.push(name);
 await atomic(this.mcpFile,doc);return this.servers();}
 async probe(name,binary,env,onRpc){
 const doc=await this.mcpDocument(),config=doc.mcpServers[name];if(!config)throw Error('MCP-Server nicht gefunden.');
 const root=await mkdtemp(path.join(this.data,'mcp-probe-'));let rpc;
 try{
 await mkdir(path.join(root,'agent'));await atomic(path.join(root,'agent/mcp.json'),{mcpServers:{[name]:{...config,enabled:true}}});
 await atomic(path.join(root,'policy.json'),{mcp:{enableProjectConfig:false},enabledProviders:[],extensions:[]});
 rpc=new Rpc(binary,['--mode','rpc-ui','--model=anthropic/claude-sonnet-4-5',`--cwd=${root}`,`--config=${path.join(root,'policy.json')}`,'--no-session','--no-title','--no-extensions','--no-skills','--no-rules','--no-lsp','--tools=read'],{...env,PI_CODING_AGENT_DIR:path.join(root,'agent')});onRpc?.(rpc);
 let output='';rpc.on('frame',f=>{if(f.type==='command_output')output+=(f.text??f.message??'')+'\n';});
 await rpc.start();const available=await rpc.request('get_available_commands');if(!available.commands?.some(c=>c.name.replace(/^\//,'')==='mcp'))throw Error('Diese OMP-Version stellt keinen MCP-Verbindungstest bereit.');
 await rpc.request('prompt',{message:`/mcp test ${name}`},35000);
 await rpc.request('get_state');
 // /mcp test is a local command: it never starts model inference or calls a tool.
 const connected=/connected \(\d+ tools\)/.test(output);
 if(!connected)throw Error('Verbindung fehlgeschlagen. Programm, URL, Zugangsdaten und Serverprotokoll prüfen.');
 const toolNames=output.split('\n').map(l=>l.match(/^\s*- (.+)$/)?.[1]).filter(Boolean);
 return {connected:true,tools:toolNames,message:`Verbunden · ${toolNames.length} Werkzeuge`};
 }finally{await rpc?.close();await rm(root,{recursive:true,force:true});}
 }
}
