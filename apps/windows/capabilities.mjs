import {readFile,writeFile,rename,mkdir,realpath,stat,symlink,rm,mkdtemp} from 'node:fs/promises';
import path from 'node:path';import {randomUUID} from 'node:crypto';import {parse} from 'yaml';import {Rpc} from './rpc.mjs';import {login as oauthLogin} from './mcp-oauth.mjs';import {McpCredentials} from './mcp-credentials.mjs';
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
function oauthConfig(raw,old,changed){
 if(raw===undefined)return changed?undefined:old;
 if(!object(raw))throw Error('Erweiterte Anmeldung ist ungültig.');
 const text=(v,max,label)=>{if(v===undefined||v===null||v==='')return '';if(typeof v!=='string'||v.length>max||/[\r\n\0]/.test(v))throw Error(label+' ist ungültig.');return v.trim();};
 // Unchanged target: keep every unmanaged OMP field (redirectUri, callbackPath, prompt, ...) and only rewrite the managed ones.
 const o=changed?{}:{...old};for(const k of ['clientId','scope','callbackPort','clientSecret'])delete o[k];
 const clientId=text(raw.clientId,512,'Client-ID'),scope=text(raw.scope,2000,'Scopes'),secret=text(raw.clientSecret,4096,'Client-Geheimnis');
 if(clientId)o.clientId=clientId;if(scope)o.scope=scope;
 if(raw.callbackPort!==undefined&&raw.callbackPort!==null&&raw.callbackPort!==''){const port=Number(raw.callbackPort);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Rückleitungs-Port muss zwischen 1024 und 65535 liegen.');o.callbackPort=port;}
 if(secret)o.clientSecret=secret;
 else if(!raw.clearSecret&&old?.clientSecret){if(changed)throw Error('Ziel geändert: Client-Geheimnis neu eingeben oder ausdrücklich entfernen.');o.clientSecret=old.clientSecret;}
 return Object.keys(o).length?o:undefined;
}
// mcp-remote proxies OAuth on its own (tokens in ~/.mcp-auth); its URL can move to a managed HTTP entry instead.
export function remoteTarget(c){
 if(!object(c)||(c.type&&c.type!=='stdio'))return null;
 const base=String(c.command||'').split(/[\\/]/).pop().replace(/\.(cmd|exe)$/i,''),args=Array.isArray(c.args)?c.args:[];let start;
 if(base==='mcp-remote')start=0;
 else if(['npx','bunx','pnpm'].includes(base)){const k=args.findIndex(a=>/^mcp-remote(@[\w.^~-]+)?$/.test(a));if(k<0||(base==='pnpm'&&!args.slice(0,k).includes('dlx')))return null;start=k+1;}
 else return null;
 const rest=args.slice(start),at=rest.findIndex(a=>/^https?:\/\//i.test(a));if(at<0)return null;
 const headers={},dropped=[];
 for(let i=0;i<rest.length;i++){if(i===at)continue;if(rest[i]==='--header'&&i+1<rest.length){const h=rest[++i],m=h.match(/^([^:\s]+)\s*:\s*(.*)$/);if(m)headers[m[1]]=m[2];else dropped.push('--header',h);}else dropped.push(rest[i]);}
 return {url:rest[at],headers,dropped};
}
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
 if(old&&!changed){for(const key of ['auth','requestIdFormat'])if(old[key]!==undefined)c[key]=old[key];}
 const oauth=c.type==='stdio'?(changed?undefined:old?.oauth):oauthConfig(raw.oauth,old?.oauth,changed);if(oauth)c.oauth=oauth;
 return c;
}
export class Capabilities {
 constructor(data){this.data=data;this.file=path.join(data,'capabilities.json');this.mcpFile=path.join(data,'agent/mcp.json');this.state={skills:[]};this.credentials=new McpCredentials(path.join(data,'agent'));this.authRequired=new Set();}
 async init(){this.state=await readJSON(this.file,{skills:[]});}
 async skills(){return Promise.all(this.state.skills.map(async s=>{try{const info=await skillInfo(s.path);if(info.name!==s.name)throw Error('Skill wurde umbenannt. Bitte neu verbinden.');return {...s,description:info.description};}catch(e){return {...s,error:e.message};}}));}
 async addSkill(source){
  const info=await skillInfo(source);if(this.state.skills.some(s=>s.name===info.name||s.path===info.path))throw Error('Dieser Skill ist bereits verbunden.');
  const s={id:randomUUID(),name:info.name,path:info.path,enabled:false};const folder=path.join(this.data,'skill-links',s.id);await mkdir(folder,{recursive:true,mode:0o700});await symlink(s.path,path.join(folder,s.name),process.platform==='win32'?'junction':'dir');
  const next={...this.state,skills:[...this.state.skills,s]};try{await atomic(this.file,next);this.state=next;}catch(e){await rm(folder,{recursive:true,force:true});throw e;}return this.skills();
 }
 async setSkill(id,enabled,remove=false){const s=this.state.skills.find(s=>s.id===id);if(!s)throw Error('Skill nicht gefunden.');if(enabled){const info=await skillInfo(s.path);if(info.name!==s.name)throw Error('Skill wurde umbenannt. Bitte neu verbinden.');}
 const next={...this.state,skills:remove?this.state.skills.filter(x=>x.id!==id):this.state.skills.map(x=>x.id===id?{...x,enabled:enabled===true}:x)};await atomic(this.file,next);this.state=next;
 if(remove)await rm(path.join(this.data,'skill-links',s.id),{recursive:true,force:true});return this.skills();}
 async preview(id){const s=this.state.skills.find(x=>x.id===id);if(!s)throw Error('Skill nicht gefunden.');return skillInfo(s.path);}
 async skillPolicy(){const active=(await this.skills()).filter(s=>s.enabled&&!s.error);return {enabled:!!active.length,enableSkillCommands:true,customDirectories:active.map(s=>path.join(this.data,'skill-links',s.id)),includeSkills:active.length?active.map(s=>s.name):['pi-desk-no-skills-selected'],enableCodexUser:false,enableClaudeUser:false,enableClaudeProject:false,enablePiUser:false,enablePiProject:false,enableAgentsUser:false,enableAgentsProject:false};}
 async mcpDocument(){const doc=await readJSON(this.mcpFile,{mcpServers:{}});if(!object(doc)||!object(doc.mcpServers))throw Error('mcp.json enthält keine gültige Server-Zuordnung.');return doc;}
 #login(c){if(!['http','sse'].includes(c.type))return undefined;const s=this.credentials.status(c.url);return s==='none'&&this.authRequired.has(c.url)?'required':s;}
 async servers(){const doc=await this.mcpDocument();return Object.entries(doc.mcpServers).map(([name,c])=>{const remote=remoteTarget(c);return {name,type:c.type||'stdio',command:c.command||'',args:c.args||[],cwd:c.cwd||'',url:c.url||'',enabled:c.enabled!==false&&!(doc.disabledServers||[]).includes(name),envKeys:Object.keys(c.env||{}),headerKeys:Object.keys(c.headers||{}),hasOAuth:!!(c.oauth||c.auth),login:this.#login(c),oauth:{clientId:c.oauth?.clientId||'',scope:c.oauth?.scope||'',callbackPort:c.oauth?.callbackPort||null,hasClientSecret:!!c.oauth?.clientSecret},remote:remote?{url:remote.url,dropped:remote.dropped}:null};});}
 // Best effort: a changed or removed server must not leave its tokens behind, but a foreign OMP store must not block the edit.
 #forget(url){if(!url)return;this.authRequired.delete(url);try{this.credentials.remove(url);}catch{}}
 async login(name,hooks={}){const c=(await this.mcpDocument()).mcpServers[name];if(!c)throw Error('MCP-Server nicht gefunden.');if(!['http','sse'].includes(c.type))throw Error('Anmelden ist nur für HTTP- und SSE-Server möglich.');
 const credential=await oauthLogin({url:c.url,type:c.type,headers:c.headers||{},oauth:c.oauth||{}},hooks);this.credentials.save(c.url,credential);this.authRequired.delete(c.url);return this.servers();}
 async logout(name){const c=(await this.mcpDocument()).mcpServers[name];if(!c?.url)throw Error('MCP-Server nicht gefunden.');this.credentials.remove(c.url);this.authRequired.delete(c.url);return this.servers();}
 async convertRemote(name){const doc=await this.mcpDocument(),c=doc.mcpServers[name],t=remoteTarget(c);if(!t)throw Error('Dieser Server nutzt kein mcp-remote.');
 const next=mcpConfig({type:'http',url:t.url,enabled:c.enabled!==false,...(Object.keys(t.headers).length?{headers:t.headers}:{})});if(c.env)next.env=c.env;doc.mcpServers[name]=next;await atomic(this.mcpFile,doc);return this.servers();}
 async saveServer(raw){if(typeof raw.name!=='string'||! /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(raw.name))throw Error('Servername: Buchstaben, Ziffern, Bindestriche oder Unterstriche (maximal 64).');const doc=await this.mcpDocument();
 if(!raw.edit&&doc.mcpServers[raw.name])throw Error('Servername ist bereits vorhanden.');
 const previous=doc.mcpServers[raw.name]?.url;doc.mcpServers[raw.name]=mcpConfig(raw.config,doc.mcpServers[raw.name]);
 doc.disabledServers=(doc.disabledServers||[]).filter(x=>x!==raw.name);doc.enabledServers=(doc.enabledServers||[]).filter(x=>x!==raw.name);
 await atomic(this.mcpFile,doc);const next=doc.mcpServers[raw.name].url;
 // Any edit ends a pending "login required"; credentials only go away with the URL they belong to.
 if(previous)this.authRequired.delete(previous);if(next)this.authRequired.delete(next);if(previous&&previous!==next)this.#forget(previous);return this.servers();}
 async setServer(name,enabled,remove=false){const doc=await this.mcpDocument();if(!Object.hasOwn(doc.mcpServers,name))throw Error('MCP-Server nicht gefunden.');
 const url=doc.mcpServers[name].url;if(remove)delete doc.mcpServers[name];else doc.mcpServers[name].enabled=enabled===true;
 doc.disabledServers=(doc.disabledServers||[]).filter(x=>x!==name);doc.enabledServers=(doc.enabledServers||[]).filter(x=>x!==name);
 // Keep an explicit denylist when disabled, so inherited sources cannot reactivate it.
 if(!enabled&&!remove)doc.disabledServers.push(name);
 await atomic(this.mcpFile,doc);if(remove)this.#forget(url);return this.servers();}
 // OMP rotates refresh tokens inside the probe copy of agent.db; carry a changed active credential back so the real store keeps the valid one.
 adoptRefreshed(url,dir,before){try{const now=new McpCredentials(dir).active(url);if(now&&now!==before)this.credentials.save(url,JSON.parse(now));}catch{}}
 async probe(name,binary,env,onRpc){
 const doc=await this.mcpDocument(),config=doc.mcpServers[name];if(!config)throw Error('MCP-Server nicht gefunden.');
 const root=await mkdtemp(path.join(this.data,'mcp-probe-'));let rpc,snapshot=false,before=null;
 try{
 await mkdir(path.join(root,'agent'));await atomic(path.join(root,'agent/mcp.json'),{mcpServers:{[name]:{...config,enabled:true}}});
 if(config.url){try{before=this.credentials.active(config.url);snapshot=this.credentials.snapshot(path.join(root,'agent'));}catch{snapshot=false;}}
 await atomic(path.join(root,'policy.json'),{mcp:{enableProjectConfig:false},enabledProviders:[],extensions:[]});
 rpc=new Rpc(binary,['--mode','rpc-ui','--model=anthropic/claude-sonnet-4-5',`--cwd=${root}`,`--config=${path.join(root,'policy.json')}`,'--no-session','--no-title','--no-extensions','--no-skills','--no-rules','--no-lsp','--tools=read'],{...env,PI_CODING_AGENT_DIR:path.join(root,'agent')});onRpc?.(rpc);
 let output='';rpc.on('frame',f=>{if(f.type==='command_output')output+=(f.text??f.message??'')+'\n';});
 await rpc.start();const available=await rpc.request('get_available_commands');if(!available.commands?.some(c=>c.name.replace(/^\//,'')==='mcp'))throw Error('Diese OMP-Version stellt keinen MCP-Verbindungstest bereit.');
 await rpc.request('prompt',{message:`/mcp test ${name}`},35000);
 await rpc.request('get_state');
 // /mcp test is a local command: it never starts model inference or calls a tool.
 const connected=/connected \(\d+ tools\)/.test(output);
 if(!connected&&config.url&&/\b40[13]\b|unauthori[sz]ed|forbidden/i.test(output)){this.authRequired.add(config.url);throw Error('Anmeldung erforderlich. Mit „Anmelden“ im Browser anmelden.');}
 if(!connected)throw Error('Verbindung fehlgeschlagen. Programm, URL, Zugangsdaten und Serverprotokoll prüfen.');
 if(config.url)this.authRequired.delete(config.url);
 const toolNames=output.split('\n').map(l=>l.match(/^\s*- (.+)$/)?.[1]).filter(Boolean);
 return {connected:true,tools:toolNames,message:`Verbunden · ${toolNames.length} Werkzeuge`};
 }finally{await rpc?.close();if(snapshot)this.adoptRefreshed(config.url,path.join(root,'agent'),before);await rm(root,{recursive:true,force:true});}
 }
}
