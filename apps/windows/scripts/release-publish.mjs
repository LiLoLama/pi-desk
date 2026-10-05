// Makes a prepared Windows release live: publish the draft, then commit and push the feed.
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline/promises';
import {fileURLToPath} from 'node:url';
import YAML from 'yaml';
const REPO='LiLoLama/pi-desk';
// The draft must be unpublished and carry the installer the feed promises (same size); returns the asset names.
export function checkDraft(view,feedYaml,version){
 const info=YAML.parse(feedYaml),name=`Pi-Desk-${version}-Windows-x64-Setup.exe`;
 if(info?.version!==version)throw Error(`Feed nennt nicht ${version}.`);
 const size=info.files?.[0]?.size;
 if(!size)throw Error(`Feed-Eintrag für ${version} hat keine Größe.`);
 if(view.isDraft!==true)throw Error(`Release windows-v${version} ist kein Entwurf.`);
 const asset=view.assets.find(a=>a.name===name);
 if(!asset)throw Error(`Anhang ${name} fehlt im Entwurf.`);
 if(String(asset.size)!==String(size))throw Error(`Anhang ${name} hat ${asset.size} Bytes, der Feed erwartet ${size}.`);
 return view.assets.map(a=>a.name);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),repo=path.resolve(root,'../..');
 const run=(cmd,args,capture=false)=>{const r=spawnSync(cmd,args,{cwd:repo,encoding:'utf8',stdio:capture?['ignore','pipe','inherit']:'inherit'});if(r.status!==0)throw Error(`${cmd} ${args[0]} fehlgeschlagen (${r.error?.message??'Exit '+r.status})`);return (r.stdout||'').trim();};
 const {version}=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')),tag=`windows-v${version}`;
 const feed='updates/windows/latest.yml';
 if(run('git',['rev-parse','--abbrev-ref','HEAD'],true)!=='main')throw Error('Ausrollen nur vom Branch main.');
 if(!run('git',['status','--porcelain','--',feed],true))throw Error('Keine Feed-Änderung. Zuerst npm run release:feed.');
 const view=JSON.parse(run('gh',['release','view',tag,'--repo',REPO,'--json','isDraft,assets'],true));
 const names=checkDraft(view,await readFile(path.join(repo,feed),'utf8'),version);
 console.log(`Entwurf: ${view.isDraft} · Anhänge: ${names.join(', ')}`);
 const rl=readline.createInterface({input:process.stdin,output:process.stdout});
 const answer=(await rl.question(`Pi Desk ${version} jetzt an alle Windows-Nutzer ausrollen? (ja/nein) `)).trim().toLowerCase();rl.close();
 if(answer!=='ja'){console.log('Abgebrochen. Nichts veröffentlicht.');process.exit(0);}
 run('gh',['release','edit',tag,'--repo',REPO,'--draft=false']);
 try{run('git',['add','--',feed]);run('git',['commit','-m',`Windows ${version} ausrollen`,'--',feed]);run('git',['push']);}
 catch(error){console.error(`${error.message}\nRelease ist öffentlich, Feed aber nicht gepusht: ${feed} manuell committen und pushen.`);process.exit(1);}
 console.log('Ausgerollt. Nutzer sehen das Update spätestens nach ihrer nächsten Prüfung (raw-Cache ca. 5 Minuten).');
}
