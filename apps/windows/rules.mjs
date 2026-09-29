import {readFile,writeFile,rename,stat,mkdir} from 'node:fs/promises';
import path from 'node:path';
const names=['AGENTS.md','CLAUDE.md','GEMINI.md','.github/copilot-instructions.md'];
export function ruleFiles(root){
  return names.map(name=>({name,path:path.join(root,name)}));
}
export async function listRules(root){
  return Promise.all(ruleFiles(root).map(async file=>{
    try{
      const s=await stat(file.path);
      if(!s.isFile())return {...file,exists:false,text:'',size:0};
      if(s.size>200000)return {...file,exists:true,text:'',size:s.size,error:'Datei ist zu groß (maximal 200 KB).'};
      const text=await readFile(file.path,'utf8');
      return {...file,exists:true,text,size:s.size};
    }catch(e){
      if(e.code==='ENOENT')return {...file,exists:false,text:'',size:0};
      throw e;
    }
  }));
}
export async function saveRule(root,name,text){
  const file=ruleFiles(root).find(f=>f.name===name);
  if(!file)throw Error('Unbekannte Regeldatei.');
  if(typeof text!=='string'||text.length>200000)throw Error('Regeltext: maximal 200.000 Zeichen.');
  if(!text.trim()){
    try{const {unlink}=await import('node:fs/promises');await unlink(file.path);}catch(e){if(e.code!=='ENOENT')throw e;}
    return listRules(root);
  }
  await mkdir(path.dirname(file.path),{recursive:true});
  await writeFile(file.path+'.tmp',text,{mode:0o600});
  await rename(file.path+'.tmp',file.path);
  return listRules(root);
}
