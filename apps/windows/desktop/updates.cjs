// Update flow: check quietly, offer with notes, download on request, install when the app is idle.
const fs=require('node:fs');
const path=require('node:path');
const {parseChangelog,sectionsNewerThan,renderNotes}=require('./changelog.cjs');
const FIRST_CHECK=10000,INTERVAL=6*60*60*1000;
const LOAD_FAILED='Das Update konnte nicht geladen oder bestätigt werden. Es wurde nichts verändert.';
const CHECK_FAILED='Update-Server nicht erreichbar. Bitte später erneut versuchen.';
const fileStore=file=>({
 read(){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return {};}},
 write(data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data,null,1));}
});
function createUpdates({updater,store,current,feedURL,send,install,timers=globalThis,now=()=>new Date()}){
 const saved={skipped:'',...store.read()};
 let status={phase:'idle',current,version:'',notes:'',percent:0,error:'',auto:saved.auto!==false,lastCheck:saved.lastCheck||''},manual=false,dismissed='',requested=false;
 const persist=()=>store.write({auto:status.auto,skipped:saved.skipped,lastCheck:status.lastCheck});
 const set=patch=>{status={...status,...patch};send({...status});return {...status};};
 const fail=()=>{
  if(status.phase==='error')return {...status};
  const loading=['downloading','ready'].includes(status.phase);requested=false;
  if(!manual&&!loading)return set({phase:'idle'});
  return set({phase:'error',error:loading?LOAD_FAILED:CHECK_FAILED});
 };
 updater.autoDownload=false;updater.autoInstallOnAppQuit=true;updater.allowDowngrade=false;
 updater.setFeedURL({provider:'generic',url:feedURL});
 updater.on('update-available',info=>{
  if(!manual&&[saved.skipped,dismissed].includes(info.version))return set({phase:'idle'});
  const notes=renderNotes(sectionsNewerThan(parseChangelog(typeof info.releaseNotes==='string'?info.releaseNotes:''),current));
  set({phase:'available',version:info.version,notes:notes||'Keine Änderungsnotizen.',error:''});
 });
 updater.on('update-not-available',()=>set({phase:manual?'upToDate':'idle'}));
 updater.on('download-progress',p=>set({phase:'downloading',percent:Math.max(0,Math.min(100,Math.round(p.percent||0)))}));
 updater.on('update-downloaded',info=>{
  set({phase:'ready',version:info.version||status.version,percent:100});
  if(requested){requested=false;Promise.resolve(install({confirmBusy:false})).catch(()=>{});}
 });
 updater.on('error',fail);
 async function check(isManual=false){
  if(['checking','downloading','ready'].includes(status.phase))return {...status};
  manual=isManual;set({phase:'checking',error:''});
  status.lastCheck=now().toISOString();persist();
  try{await updater.checkForUpdates();}catch{fail();}
  if(status.phase==='checking')set({phase:manual?'upToDate':'idle'});
  return {...status};
 }
 async function download(){
  if(status.phase!=='available')return {...status};
  requested=true;set({phase:'downloading',percent:0});
  try{await updater.downloadUpdate();}catch{fail();}
  return {...status};
 }
 const skip=()=>{saved.skipped=status.version;persist();return set({phase:'idle'});};
 const later=()=>{if(status.phase!=='available')return {...status};dismissed=status.version;return set({phase:'idle'});};
 const setAuto=value=>{status.auto=Boolean(value);persist();return set({});};
 async function installNow(){if(status.phase==='ready')await install({confirmBusy:true});return {...status};}
 function start(){timers.setTimeout(()=>{if(status.auto)check(false);},FIRST_CHECK);timers.setInterval(()=>{if(status.auto)check(false);},INTERVAL);}
 return {start,check,download,skip,later,setAuto,installNow,status:()=>({...status})};
}
module.exports={createUpdates,fileStore,FIRST_CHECK,INTERVAL};
