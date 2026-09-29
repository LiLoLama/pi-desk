import {realpath,stat,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
async function git(root,args,timeout=15000){
  const {stdout}=await exec('git',['-C',root,'--no-pager',...args],{timeout,maxBuffer:2e6,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}});
  return stdout;
}
export async function gitRepo(root){
  const full=await realpath(root);
  try{const dir=(await git(full,['rev-parse','--show-toplevel'])).trim();return dir||full;}
  catch{throw Error('Dieses Projekt ist kein Git-Repository.');}
}
function parsePorcelain(text){
  const rows=[];let current=null;
  for(const line of String(text||'').split('\n')){
    if(line.startsWith('worktree ')){
      if(current)rows.push(current);
      current={path:line.slice(9),head:'',branch:'',bare:false,detached:false,locked:false,prunable:false};
    }else if(!current)continue;
    else if(line.startsWith('HEAD '))current.head=line.slice(5);
    else if(line.startsWith('branch '))current.branch=line.slice(7).replace(/^refs\/heads\//,'');
    else if(line==='bare')current.bare=true;
    else if(line==='detached')current.detached=true;
    else if(line.startsWith('locked'))current.locked=true;
    else if(line.startsWith('prunable'))current.prunable=true;
  }
  if(current)rows.push(current);
  return rows;
}
export async function listWorktrees(root){
  const repo=await gitRepo(root);
  const rows=parsePorcelain(await git(repo,['worktree','list','--porcelain']));
  return {repo,worktrees:rows};
}
export async function addWorktree(root,raw){
  const repo=await gitRepo(root);
  const dest=typeof raw.path==='string'?raw.path.trim():'';
  if(!dest||dest.length>500||/[\r\n\0]/.test(dest))throw Error('Zielordner für den Worktree angeben.');
  const abs=path.isAbsolute(dest)?dest:path.resolve(repo,'..',dest);
  if(await stat(abs).then(()=>true,e=>e.code==='ENOENT'?false:Promise.reject(e)))throw Error('Zielordner existiert bereits.');
  await mkdir(path.dirname(abs),{recursive:true,mode:0o700});
  const args=['worktree','add'];
  if(raw.detach===true)args.push('--detach');
  else if(typeof raw.branch==='string'&&raw.branch.trim()){
    if(!/^[A-Za-z0-9._/-]{1,80}$/.test(raw.branch.trim()))throw Error('Ungültiger Branch-Name.');
    args.push('-b',raw.branch.trim());
  }
  args.push(abs);
  if(typeof raw.commit==='string'&&raw.commit.trim()){
    if(!/^[A-Za-z0-9._/-]{1,120}$/.test(raw.commit.trim()))throw Error('Ungültige Commit-Angabe.');
    args.push(raw.commit.trim());
  }
  await git(repo,args,30000);
  return listWorktrees(repo);
}
export async function removeWorktree(root,target){
  const repo=await gitRepo(root);
  if(typeof target!=='string'||!target.trim())throw Error('Worktree-Pfad fehlt.');
  const abs=await realpath(target.trim());
  const listed=await listWorktrees(repo);
  if(!listed.worktrees.some(w=>path.resolve(w.path)===path.resolve(abs)))throw Error('Worktree gehört nicht zu diesem Repository.');
  if(abs===listed.repo)throw Error('Das Hauptarbeitsverzeichnis kann nicht entfernt werden.');
  if((await git(abs,['status','--porcelain','--untracked-files=all'])).trim())throw Error('Worktree enthält Änderungen. Erst sichern; es wird nichts gelöscht.');
  await git(repo,['worktree','remove',abs],30000);
  return listWorktrees(repo);
}
export async function gitOverview(root){
  const repo=await gitRepo(root);
  const branch=(await git(repo,['branch','--show-current'])).trim();
  const status=await git(repo,['status','--short']);
  const trees=await listWorktrees(repo);
  return {repo,branch,status,worktrees:trees.worktrees};
}
