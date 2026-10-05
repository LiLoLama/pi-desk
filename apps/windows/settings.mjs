import {readFile,writeFile,rename,unlink,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {parseDocument} from 'yaml';

const defaults={
  version:1,connections:[],instructions:'',thinking:'auto',
  browser:false,browserHeadless:true,browserCdpUrl:'',
  lsp:true,pty:false,webSearch:true,github:false,securityScan:false,
  memory:'off',advisor:false,autoCompaction:true,autoRetry:true,
  extensions:false,xdev:true,fastMode:false,mcpProject:false,computer:false,prewalk:false,
  steeringMode:'all',followUpMode:'all',interruptMode:'immediate'
};
const memories=new Set(['off','local','hindsight','mnemopi']);
const queueModes=new Set(['all','one-at-a-time']);
const interruptModes=new Set(['immediate','wait']);
function flag(value,label){if(typeof value!=='boolean')throw Error('Ungültige '+label+'-Einstellung.');return value;}
const kinds=new Set(['ollama','lm-studio','openai']);
export function validateConnection(raw) {
  if(!raw||!kinds.has(raw.kind))throw Error('Bitte einen gültigen Verbindungstyp wählen.');
  let url;try{url=new URL(raw.baseUrl);}catch{throw Error('Bitte eine vollständige Server-URL eingeben.');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error('Server-URL muss HTTP oder HTTPS verwenden, ohne Zugangsdaten, Suchparameter oder Fragment.');
  const name=String(raw.name||'').trim();if(!name||name.length>80)throw Error('Name muss 1–80 Zeichen enthalten.');
  const apiKey=raw.apiKey;
  if(apiKey!==undefined&&(typeof apiKey!=='string'||apiKey.length>4096||apiKey.startsWith('!')||/[\r\n]/.test(apiKey)))throw Error('Ungültiger API-Schlüssel.');
  const models=raw.models??[];
  if(!Array.isArray(models)||models.length>200||models.some(x=>typeof x!=='string'||!x.trim()||x.length>256))throw Error('Modell-IDs müssen nichtleere Texte sein (maximal 200).');
  const base=url.toString().replace(/\/$/,'');
  return {name,kind:raw.kind,baseUrl:base,models:[...new Set(models.map(x=>x.trim()))],...(apiKey!==undefined?{apiKey}:{}),clearKey:raw.clearKey===true};
}
function providerConfig(c) {
  const base=c.baseUrl.replace(/\/v1\/?$/,'');
  return {baseUrl:c.kind==='ollama'?base:c.baseUrl,api:c.kind==='ollama'?'openai-responses':'openai-completions',
    ...(c.apiKey?{apiKey:c.apiKey}:{auth:'none'}),
    ...(c.models.length?{models:c.models.map(id=>({id,name:c.managed?c.name:id,reasoning:false,input:['text'],contextWindow:c.managed?c.contextWindow:32768,maxTokens:c.managed?2048:4096}))}:
      {discovery:{type:c.kind==='openai'?'openai-models-list':c.kind}})};
}
export class SettingsStore {
  constructor(data){this.data=data;this.file=path.join(data,'settings.json');this.models=path.join(data,'agent/models.yml');this.instructions=path.join(data,'agent/pi-desk-instructions.md');this.state=structuredClone(defaults);}
  async init(){try{this.state={...structuredClone(defaults),...JSON.parse(await readFile(this.file,'utf8'))};}catch(e){if(e.code!=='ENOENT')throw e;}}
  public(){return {...this.state,connections:this.state.connections.map(({apiKey,...c})=>({...c,hasApiKey:!!apiKey}))};}
  async loadModels(){
    let content='';for(const candidate of [this.models,this.models.replace(/yml$/,'yaml'),this.models.replace(/yml$/,'json')]){try{content=await readFile(candidate,'utf8');break;}catch(e){if(e.code!=='ENOENT')throw e;}}
    const doc=parseDocument(content||'providers: {}\n');
    if(doc.errors.length)throw Error('models.yml enthält ungültiges YAML. Bitte zuerst korrigieren.');
    const value=doc.toJS();if(value&&(!value.providers||typeof value.providers!=='object'||Array.isArray(value.providers)))throw Error('models.yml: providers muss eine Zuordnung sein.');
    return {content,doc};
  }
  async commit(next){
    const {doc}=await this.loadModels();
    for(const c of this.state.connections)doc.deleteIn(['providers',c.id]);
    for(const c of next.connections)doc.setIn(['providers',c.id],providerConfig(c));
    // The private journal allows recovery after a process crash between the two renames.
    const journal=path.join(this.data,'settings-transaction.json');
    await writeFile(journal,JSON.stringify({settings:next,models:String(doc)}),{mode:0o600});
    await this.finishTransaction({settings:next,models:String(doc)});
    await unlink(journal);this.state=next;
  }
  async finishTransaction(tx){
    await mkdir(path.dirname(this.models),{recursive:true,mode:0o700});
    for(const [file,content] of [[this.models,tx.models],[this.file,JSON.stringify(tx.settings,null,2)],[this.instructions,tx.settings.instructions]]){
      await writeFile(file+'.tmp',content,{mode:0o600});await rename(file+'.tmp',file);
    }
  }
  async recover(){try{const tx=JSON.parse(await readFile(path.join(this.data,'settings-transaction.json'),'utf8'));await this.finishTransaction(tx);await unlink(path.join(this.data,'settings-transaction.json'));}catch(e){if(e.code!=='ENOENT')throw e;}await this.init();}
  async saveConnection(raw){
    const input=validateConnection(raw),next=structuredClone(this.state);
    const old=raw.id?next.connections.find(c=>c.id===raw.id):null;
    if(old?.managed)throw Error('Dieses Modell wird in der lokalen Bibliothek verwaltet.');
    if(raw.id&&!old)throw Error('Verbindung wurde nicht gefunden. Bitte neu laden.');
    if(old&&old.baseUrl!==input.baseUrl&&old.apiKey&&input.apiKey===undefined&&!input.clearKey)throw Error('Für eine geänderte Server-URL bitte den Schlüssel neu eingeben oder entfernen.');
    const c={...input,id:old?.id||'pi-desk-'+randomUUID(),apiKey:input.clearKey?'':input.apiKey===undefined?(old?.apiKey||''):input.apiKey};delete c.clearKey;
    if(old)next.connections[next.connections.indexOf(old)]=c;else next.connections.push(c);
    await this.commit(next);return this.public();
  }
  async managedLocal(connection){const next=structuredClone(this.state);next.connections=next.connections.filter(c=>c.id!=='pi-desk-local');if(connection)next.connections.push({...validateConnection(connection),contextWindow:Number.isInteger(connection.contextWindow)&&connection.contextWindow>=4096&&connection.contextWindow<=262144?connection.contextWindow:32768,id:'pi-desk-local',managed:true});await this.commit(next);}
  async removeConnection(id){if(!this.state.connections.some(c=>c.id===id))throw Error('Verbindung nicht gefunden.');const next=structuredClone(this.state);next.connections=next.connections.filter(c=>c.id!==id);await this.commit(next);return this.public();}
  async saveAgent(raw){
    if(typeof raw.instructions!=='string'||raw.instructions.length>20000)throw Error('Persönliche Hinweise: maximal 20.000 Zeichen.');
    if(!['off','minimal','low','medium','high','xhigh','max','auto'].includes(raw.thinking))throw Error('Ungültige Denkstufe.');
    if(raw.browser!==undefined&&typeof raw.browser!=='boolean')throw Error('Ungültige Browser-Einstellung.');
    if(raw.browserHeadless!==undefined&&typeof raw.browserHeadless!=='boolean')throw Error('Ungültige Browser-Anzeige.');
    let browserCdpUrl=this.state.browserCdpUrl||'';
    if(raw.browserCdpUrl!==undefined){
      if(typeof raw.browserCdpUrl!=='string'||raw.browserCdpUrl.length>300)throw Error('CDP-Adresse ist zu lang.');
      const value=raw.browserCdpUrl.trim();
      if(value){
        let url;try{url=new URL(value);}catch{throw Error('CDP-Adresse muss eine HTTP-URL sein, zum Beispiel http://127.0.0.1:9222.');}
        if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.hash)throw Error('CDP-Adresse muss HTTP oder HTTPS verwenden, ohne Zugangsdaten.');
        browserCdpUrl=url.toString().replace(/\/$/,'');
      }else browserCdpUrl='';
    }
    const pick=(key,fallback,cast)=>{
      if(raw[key]===undefined)return this.state[key]??fallback;
      return cast(raw[key]);
    };
    const memory=pick('memory',this.state.memory||'off',v=>{if(!memories.has(v))throw Error('Ungültiges Memory-Backend.');return v;});
    const steeringMode=pick('steeringMode',this.state.steeringMode||'all',v=>{if(!queueModes.has(v))throw Error('Ungültiger Steering-Modus.');return v;});
    const followUpMode=pick('followUpMode',this.state.followUpMode||'all',v=>{if(!queueModes.has(v))throw Error('Ungültiger Follow-up-Modus.');return v;});
    const interruptMode=pick('interruptMode',this.state.interruptMode||'immediate',v=>{if(!interruptModes.has(v))throw Error('Ungültiger Interrupt-Modus.');return v;});
    await this.commit({
      ...this.state,
      instructions:raw.instructions,
      thinking:raw.thinking,
      browser:raw.browser===undefined?this.state.browser===true:raw.browser===true,
      browserHeadless:raw.browserHeadless===undefined?this.state.browserHeadless!==false:raw.browserHeadless!==false,
      browserCdpUrl,
      lsp:pick('lsp',true,v=>flag(v,'LSP')),
      pty:pick('pty',false,v=>flag(v,'PTY')),
      webSearch:pick('webSearch',true,v=>flag(v,'Websuche')),
      github:pick('github',false,v=>flag(v,'GitHub')),
      securityScan:pick('securityScan',false,v=>flag(v,'Sicherheitsprüfung')),
      memory,
      advisor:pick('advisor',false,v=>flag(v,'Advisor')),
      autoCompaction:pick('autoCompaction',true,v=>flag(v,'Komprimierung')),
      autoRetry:pick('autoRetry',true,v=>flag(v,'Wiederholung')),
      extensions:pick('extensions',false,v=>flag(v,'Erweiterungen')),
      xdev:pick('xdev',true,v=>flag(v,'xd://')),
      fastMode:pick('fastMode',false,v=>flag(v,'Schnellmodus')),
      mcpProject:pick('mcpProject',false,v=>flag(v,'Projekt-MCP')),
      computer:pick('computer',false,v=>flag(v,'Computer-Use')),
      prewalk:pick('prewalk',false,v=>flag(v,'Prewalk')),
      steeringMode,followUpMode,interruptMode
    });return this.public();
  }
  async testConnection(raw){
    const c=validateConnection(raw),old=this.state.connections.find(x=>x.id===raw.id);
    const key=c.clearKey?'':c.apiKey===undefined?(old?.apiKey||''):c.apiKey;
    // Never send a saved credential to an edited endpoint without re-entry.
    if(old&&old.baseUrl!==c.baseUrl&&key&&c.apiKey===undefined)throw Error('Für eine geänderte Server-URL bitte den Schlüssel neu eingeben oder entfernen.');
    const base=c.baseUrl.replace(/\/$/,'');
    const endpoint=c.kind==='ollama'?base.replace(/\/v1$/,'')+'/api/tags':base.replace(/\/v1$/,'')+'/v1/models';
    let response;
    try{response=await fetch(endpoint,{headers:key?{Authorization:'Bearer '+key}:{},redirect:'error',signal:AbortSignal.timeout(8000)});}catch{throw Error('Server nicht erreichbar. Server starten und URL sowie Port prüfen.');}
    if(!response.ok){await response.body?.cancel();throw Error(response.status===401||response.status===403?'Zugriff abgelehnt. API-Schlüssel prüfen.':`Der Server meldet HTTP ${response.status}. API-Endpunkt prüfen.`);}
    let body='',size=0;for await(const chunk of response.body){size+=chunk.length;if(size>2_000_000)throw Error('Modellliste ist zu groß.');body+=Buffer.from(chunk).toString('utf8');}
    let json;try{json=JSON.parse(body);}catch{throw Error('Der Server liefert keine gültige JSON-Modellliste.');}
    const rows=c.kind==='ollama'?json.models:json.data;
    if(!Array.isArray(rows))throw Error('Die Antwort enthält keine unterstützte Modellliste.');
    const models=[...new Set(rows.map(x=>c.kind==='ollama'?(x.name||x.model):x.id).filter(x=>typeof x==='string'&&x.length<=256))];
    return {models,message:models.length?`${models.length} Modelle gefunden.`:'Server erreichbar, aber keine Modelle geladen.'};
  }
}
