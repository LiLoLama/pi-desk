import {readFile,writeFile,rename,realpath,stat,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
async function readJSON(file,fallback){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw Error('Konfigurationsdatei ist nicht lesbar: '+path.basename(file));}}
async function atomic(file,value){await writeFile(file+'.tmp',JSON.stringify(value,null,2),{mode:0o600});await rename(file+'.tmp',file);}
function parseJson(text){
  const raw=String(text||'').trim();
  if(!raw)return {};
  try{return JSON.parse(raw);}catch{throw Error(raw.slice(0,400)||'OMP lieferte keine JSON-Antwort.');}
}
export async function pluginInfo(source){
  const root=await realpath(source);
  if(!(await stat(root)).isDirectory())throw Error('Bitte den Plugin-Ordner mit package.json wählen.');
  const file=path.join(root,'package.json');
  if((await stat(file)).size>250000)throw Error('package.json ist zu groß.');
  let pkg;try{pkg=JSON.parse(await readFile(file,'utf8'));}catch{throw Error('Ungültige package.json.');}
  if(!object(pkg)||typeof pkg.name!=='string'||!pkg.name.trim()||pkg.name.length>120)throw Error('package.json braucht einen Namen.');
  return {name:pkg.name.trim(),version:typeof pkg.version==='string'?pkg.version:'',path:root};
}
export async function hookInfo(source){
  const file=await realpath(source);
  const s=await stat(file);
  if(!s.isFile()||s.size>500000)throw Error('Hook muss eine Datei bis 500 KB sein.');
  if(!/\.(mjs|js|ts|cjs)$/i.test(file))throw Error('Hook: .js, .mjs, .cjs oder .ts.');
  return {name:path.basename(file),path:file};
}
export class Plugins {
  constructor(data,binary){this.data=data;this.binary=binary;this.file=path.join(data,'extensions.json');this.home=path.join(data,'omp-home');this.state={plugins:[],hooks:[]};this.installedCache=null;}
  async init(){await mkdir(this.home,{recursive:true,mode:0o700});this.state={plugins:[],hooks:[],...await readJSON(this.file,{plugins:[],hooks:[]})};if(!Array.isArray(this.state.plugins))this.state.plugins=[];if(!Array.isArray(this.state.hooks))this.state.hooks=[];}
  async persist(next){await atomic(this.file,next);this.state=next;}
  async plugins(){return Promise.all(this.state.plugins.map(async p=>{try{const info=await pluginInfo(p.path);return {...p,name:info.name,version:info.version};}catch(e){return {...p,error:e.message};}}));}
  async hooks(){return Promise.all(this.state.hooks.map(async h=>{try{await hookInfo(h.path);return h;}catch(e){return {...h,error:e.message};}}));}
  async addPlugin(source){
    const info=await pluginInfo(source);
    if(this.state.plugins.some(p=>p.path===info.path||p.name===info.name))throw Error('Dieses Plugin ist bereits verbunden.');
    const p={id:randomUUID(),name:info.name,path:info.path,enabled:false,version:info.version};
    await this.persist({...this.state,plugins:[...this.state.plugins,p]});
    return this.plugins();
  }
  async setPlugin(id,enabled,remove=false){
    const p=this.state.plugins.find(x=>x.id===id);if(!p)throw Error('Plugin nicht gefunden.');
    if(enabled)await pluginInfo(p.path);
    await this.persist({...this.state,plugins:remove?this.state.plugins.filter(x=>x.id!==id):this.state.plugins.map(x=>x.id===id?{...x,enabled:enabled===true}:x)});
    return this.plugins();
  }
  async addHook(source){
    const info=await hookInfo(source);
    if(this.state.hooks.some(h=>h.path===info.path))throw Error('Dieser Hook ist bereits verbunden.');
    const h={id:randomUUID(),name:info.name,path:info.path,enabled:false};
    await this.persist({...this.state,hooks:[...this.state.hooks,h]});
    return this.hooks();
  }
  async setHook(id,enabled,remove=false){
    const h=this.state.hooks.find(x=>x.id===id);if(!h)throw Error('Hook nicht gefunden.');
    if(enabled)await hookInfo(h.path);
    await this.persist({...this.state,hooks:remove?this.state.hooks.filter(x=>x.id!==id):this.state.hooks.map(x=>x.id===id?{...x,enabled:enabled===true}:x)});
    return this.hooks();
  }
  async enabledDirs(){return (await this.plugins()).filter(p=>p.enabled&&!p.error).map(p=>p.path);}
  async enabledHooks(){return (await this.hooks()).filter(h=>h.enabled&&!h.error).map(h=>h.path);}
  env(){return {...process.env,HOME:this.home,PI_CODING_AGENT_DIR:path.join(this.data,'agent')};}
  async cli(args,timeout=25000){
    try{
      const {stdout,stderr}=await exec(this.binary,args,{timeout,maxBuffer:2e6,env:this.env()});
      return parseJson(stdout||stderr);
    }catch(e){
      const detail=(e.stdout||e.stderr||e.message||'').toString().replace(/\s+/g,' ').trim();
      if(/Executable not found in \$PATH: "bun"/i.test(detail))throw Error('npm-/Marketplace-Plugins brauchen Bun im PATH. Lokale Ordner funktionieren ohne Bun.');
      throw Error(detail.slice(0,400)||'Plugin-Befehl fehlgeschlagen.');
    }
  }
  flattenInstalled(doc){
    const rows=[];
    for(const [source,list] of Object.entries(object(doc)?doc:{})){
      if(!Array.isArray(list))continue;
      for(const item of list){
        if(!object(item)||typeof item.name!=='string')continue;
        rows.push({name:item.name,version:item.version||'',path:item.path||'',enabled:item.enabled!==false,source,features:item.enabledFeatures||null});
      }
    }
    return rows;
  }
  async installed(){
    if(this.installedCache)return this.installedCache;
    try{this.installedCache=this.flattenInstalled(await this.cli(['plugin','list','--json']));}
    catch{this.installedCache=[];}
    return this.installedCache;
  }
  async install(target){
    if(typeof target!=='string'||!target.trim()||target.length>300||/[\r\n\0]/.test(target))throw Error('Paket, Pfad oder Quelle angeben.');
    const value=target.trim();
    this.installedCache=null;
    await this.cli(['plugin','install',value,'--json'],120000);
    return this.installed();
  }
  async setInstalled(name,enabled){
    if(typeof name!=='string'||!/^[a-zA-Z0-9@/_-]{1,120}$/.test(name))throw Error('Ungültiger Plugin-Name.');
    this.installedCache=null;
    await this.cli(['plugin',enabled?'enable':'disable',name,'--json']);
    return this.installed();
  }
  async marketplaceAdd(source){
    if(typeof source!=='string'||!source.trim()||source.length>400||/[\r\n\0]/.test(source))throw Error('Marketplace-Quelle angeben.');
    await this.cli(['plugin','marketplace','add',source.trim(),'--json'],60000);
    return {ok:true};
  }
}
