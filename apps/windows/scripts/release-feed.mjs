// Turns the latest.yml of a draft release into the public update feed (updates/windows/latest.yml).
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import YAML from 'yaml';
const {parseChangelog,section,renderNotes,compareVersions}=createRequire(import.meta.url)('../desktop/changelog.cjs');
const REPO='LiLoLama/pi-desk';
export function feedFromRelease(latest,{tag,version,changelog}){
 const info=YAML.parse(latest);
 if(info.version!==version)throw Error(`latest.yml nennt ${info.version}, erwartet ${version}.`);
 section(changelog,version);
 const asset=name=>/^https:\/\//.test(name)?name:`https://github.com/${REPO}/releases/download/${tag}/${encodeURIComponent(name)}`;
 const recent=parseChangelog(changelog).filter(e=>compareVersions(e.version,version)<=0).sort((a,b)=>compareVersions(b.version,a.version)).slice(0,10);
 return YAML.stringify({...info,files:info.files.map(f=>({...f,url:asset(f.url)})),path:asset(info.path),releaseNotes:renderNotes(recent)});
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),repo=path.resolve(root,'../..');
 const {version}=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')),tag=`windows-v${version}`;
 const feed=path.join(repo,'updates','windows','latest.yml'),relative=path.relative(repo,feed).split(path.sep).join('/');
 // A clean feed that already names this version is live: never overwrite it silently.
 const live=await readFile(feed,'utf8').then(text=>YAML.parse(text)?.version===version,()=>false);
 if(live&&!spawnSync('git',['status','--porcelain','--',relative],{cwd:repo,encoding:'utf8'}).stdout.trim())throw Error(`Feed für ${version} ist bereits ausgerollt.`);
 const tmp=await mkdtemp(path.join(os.tmpdir(),'pi-desk-feed-'));
 try{
  const result=spawnSync('gh',['release','download',tag,'--repo',REPO,'--pattern','latest.yml','--dir',tmp],{stdio:'inherit'});
  if(result.status!==0)throw Error(`latest.yml aus ${tag} nicht ladbar. Ist der Windows-Workflow fertig?`);
  await mkdir(path.dirname(feed),{recursive:true});
  await writeFile(feed,feedFromRelease(await readFile(path.join(tmp,'latest.yml'),'utf8'),{tag,version,changelog:await readFile(path.join(root,'CHANGELOG.md'),'utf8')}));
  console.log(`Feed lokal geschrieben: updates/windows/latest.yml (${version}).\nEntwurf testen, dann: npm run release:publish`);
 }finally{await rm(tmp,{recursive:true,force:true});}
}
