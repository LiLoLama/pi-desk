import {readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
export const shortcutDefaults={new:'Ctrl+N',open:'Ctrl+O',search:'Ctrl+K',inspector:'Ctrl+Shift+I'};
export function approvalKey(request){
 const text=[request.title,request.message].filter(Boolean).join('\n');
 if(!(request.method==='confirm'||request.method==='select'&&request.options?.includes('Approve'))||/provider safety checks:/i.test(text))return '';
 return text.split('\n').map(s=>s.match(/^Allow tool: ([\w.-]{1,160})\s*$/)?.[1]).find(Boolean)||'';
}
export function approvedResponse(request){return request.method==='confirm'?{confirmed:true}:{value:'Approve'};}
export function validateDesktop(raw){
 const fontSize=Number(raw.fontSize);if(!Number.isInteger(fontSize)||fontSize<12||fontSize>24)throw Error('Schriftgröße: 12–24 Pixel.');
 const shortcuts={};const used=new Set();
 for(const name of Object.keys(shortcutDefaults)){
  const value=raw.shortcuts?.[name];
  if(typeof value!=='string'||! /^(Ctrl\+)(Shift\+)?(Alt\+)?[A-Z0-9]$/.test(value)||['Ctrl+C','Ctrl+V','Ctrl+X','Ctrl+A','Ctrl+Z','Ctrl+Y','Ctrl+R','Ctrl+W','Ctrl+Q'].includes(value)||used.has(value))throw Error('Tastenkürzel müssen eindeutig sein und dürfen keine Standardbearbeitung überschreiben.');
  shortcuts[name]=value;used.add(value);
 }
 return {fontSize,reducedMotion:raw.reducedMotion===true,pet:raw.pet===true,shortcuts};
}
export class DesktopSettings {
 constructor(data){this.file=path.join(data,'desktop-settings.json');this.state={fontSize:14,reducedMotion:false,pet:false,shortcuts:{...shortcutDefaults},approvals:{global:[],chats:{}}};this.queue=Promise.resolve();}
 async init(){try{const saved=JSON.parse(await readFile(this.file,'utf8'));this.state={...this.state,...validateDesktop(saved),approvals:saved.approvals||this.state.approvals};}catch(e){if(e.code!=='ENOENT')throw e;}}
 persist(){const text=JSON.stringify(this.state,null,2);this.queue=this.queue.catch(()=>{}).then(async()=>{await writeFile(this.file+'.tmp',text,{mode:0o600});await rename(this.file+'.tmp',this.file);});return this.queue;}
 async update(raw){this.state={...this.state,...validateDesktop(raw)};await this.persist();return this.state;}
 remembers(request,owner){const key=approvalKey(request);return !!key&&(this.state.approvals.global.includes(key)||(this.state.approvals.chats[owner]||[]).includes(key));}
 async remember(request,owner,scope){const key=approvalKey(request);if(!key||!['chat','global'].includes(scope))return;const rules=scope==='global'?this.state.approvals.global:(this.state.approvals.chats[owner]??=[]);if(!rules.includes(key))rules.push(key);await this.persist();}
 async clear(){this.state.approvals={global:[],chats:{}};await this.persist();return this.state;}
}
