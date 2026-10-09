const {app,BrowserWindow,dialog,ipcMain,Menu,shell,session,clipboard}=require('electron');
const {spawn}=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs/promises');
const {randomBytes}=require('node:crypto');
const {isLocal,externalURL}=require('./security.cjs');
const {autoUpdater}=require('electron-updater');
const {createUpdates,fileStore,installDecision}=require('./updates.cjs');
const UPDATE_FEED='https://raw.githubusercontent.com/LiLoLama/pi-desk/main/updates/windows/';
let window,helper,origin,token,updates,quitting=false,closing=false;
app.setName('Pi Desk');
// Electron profile and agent data live outside the distributable/cloud folder.
const home=process.env.LOCALAPPDATA||app.getPath('appData');
const profile=process.env.PI_DESK_DESKTOP_DATA||path.join(home,process.platform==='win32'?'Pi Desk':'Pi Desk Windows Dev');
app.setPath('userData',path.join(profile,'desktop'));
if(!app.requestSingleInstanceLock())app.quit();
else {
 app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
 app.whenReady().then(boot).catch(async error=>{dialog.showErrorBox('Pi Desk konnte nicht starten',error.message);await shutdown();app.exit(1);});
}
async function startHelper(){
 token=randomBytes(32).toString('hex');
 const env={...process.env,ELECTRON_RUN_AS_NODE:'1',PI_DESK_DATA:path.join(profile,'engine'),PI_DESK_PORT:'0',PI_DESK_NATIVE_TOKEN:token};
 if(app.isPackaged)env.PI_DESK_OMP=path.join(process.resourcesPath,'runtime','omp.exe');
 helper=spawn(process.execPath,[path.join(app.getAppPath(),'server.mjs')],{env,windowsHide:true,stdio:['pipe','pipe','pipe']});
 return new Promise((resolve,reject)=>{
  let output='',errors='';const timeout=setTimeout(()=>reject(Error('Der lokale Dienst antwortet nicht. Pi Desk bitte erneut starten.')),30000);
  helper.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/Pi Desk (http:\/\/127\.0\.0\.1:\d+)/);if(match){clearTimeout(timeout);resolve(match[1]);}});
  helper.stderr.on('data',chunk=>errors=(errors+chunk).slice(-3000));
  helper.once('error',e=>{clearTimeout(timeout);reject(e);});
  helper.once('exit',code=>{clearTimeout(timeout);if(!origin)reject(Error(errors||`Lokaler Dienst beendet (${code}).`));else if(!quitting){dialog.showErrorBox('Verbindung beendet','Der lokale Dienst wurde beendet. Bitte Pi Desk neu starten.');quitting=true;app.quit();}});
 });
}
async function shutdown(){
 if(!helper||helper.exitCode!==null)return;
 await new Promise(resolve=>{
  const timer=setTimeout(()=>{
   if(process.platform==='win32'){
    const killer=spawn('taskkill.exe',['/pid',String(helper.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
    killer.once('error',()=>helper.kill());killer.once('close',resolve);
   }else helper.kill('SIGKILL');
   resolve();
  },8000);
  helper.once('exit',()=>{clearTimeout(timer);resolve();});
  helper.stdin.end();
 });
}
async function openExternal(url){
 const safe=externalURL(url);if(!safe)return;
 const {response}=await dialog.showMessageBox(window,{type:'question',title:'Im Browser öffnen',message:'Diese Adresse im Standardbrowser öffnen?',detail:safe,buttons:['Abbrechen','Öffnen'],defaultId:0,cancelId:0});
 if(response===1)await shell.openExternal(safe);
}
// true = work running, false = idle, null = unknown (service slow or unreachable).
async function engineBusy(){
 try{const state=await fetch(origin+'/api/state',{headers:{'X-Pi-Desk-Native':token},signal:AbortSignal.timeout(2000)}).then(r=>r.json());return Boolean(state.authBusy||state.tasks?.some(t=>t.busy));}
 catch{return null;}
}
async function confirmInterrupt(){
 const {response}=await dialog.showMessageBox(window,{type:'question',title:'Laufende Arbeit beenden?',message:'Der Agent arbeitet noch. Beim Beenden wird der Vorgang abgebrochen.',buttons:['Weiterarbeiten','Beenden'],defaultId:0,cancelId:0});
 return response===1;
}
async function requestClose(){
 if(closing)return;closing=true;
 // The user wants to quit: an unknown state (null) does not block quitting, only known running work asks.
 try{if(await engineBusy()===true&&!await confirmInterrupt())return;quitting=true;await shutdown();app.quit();}finally{closing=false;}
}
// Never interrupt running or unknown work without asking; automatic installs simply wait (phase stays ready,
// autoInstallOnAppQuit installs at the next quit).
async function installUpdate({confirmBusy}){
 if(closing)return false;closing=true;
 try{
  const decision=installDecision(await engineBusy(),confirmBusy);
  if(decision==='wait'||(decision==='ask'&&!await confirmInterrupt()))return false;
  quitting=true;await shutdown();autoUpdater.quitAndInstall(true,true);return true;
 }finally{closing=false;}
}
function updateLogger(){
 const file=path.join(profile,'desktop','logs','updates.log');
 const write=level=>message=>{fs.mkdir(path.dirname(file),{recursive:true}).then(()=>fs.appendFile(file,`${new Date().toISOString()} ${level} ${message}\n`)).catch(()=>{});};
 return {info:write('info'),warn:write('warn'),error:write('error'),debug:()=>{}};
}
async function boot(){
 origin=await startHelper();
 const ses=session.fromPartition('persist:pi-desk');
 ses.setPermissionRequestHandler((_web,_permission,callback)=>callback(false));
 ses.setPermissionCheckHandler(()=>false);
 // Add the secret only to this window's own loopback requests. It never enters page JS.
 ses.webRequest.onBeforeSendHeaders({urls:[origin+'/*']},(details,callback)=>{
  if(!window||window.isDestroyed()||details.webContentsId!==window.webContents.id)return callback({cancel:true});
  callback({requestHeaders:{...details.requestHeaders,'X-Pi-Desk-Native':token}});
 });
 ses.on('will-download',event=>event.preventDefault());
 window=new BrowserWindow({title:'Pi Desk',width:1320,height:880,minWidth:760,minHeight:560,backgroundColor:'#1b1d1e',show:false,autoHideMenuBar:true,webPreferences:{session:ses,preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,spellcheck:false}});
 window.webContents.setWindowOpenHandler(({url})=>{openExternal(url).catch(()=>{});return {action:'deny'};});
 window.webContents.on('will-navigate',(event,url)=>{if(!isLocal(url,origin)){event.preventDefault();openExternal(url).catch(()=>{});}});
 window.webContents.on('will-attach-webview',event=>event.preventDefault());
 window.on('close',event=>{if(!quitting){event.preventDefault();requestClose();}});
 ipcMain.handle('pi:choose-project',async event=>{
  if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||!isLocal(event.senderFrame.url,origin))throw Error('Nicht erlaubte Anfrage');
  const result=await dialog.showOpenDialog(window,{title:'Projektordner öffnen',properties:['openDirectory','createDirectory']});
  return result.canceled?null:result.filePaths[0];
 });
 const trusted=event=>{if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||!isLocal(event.senderFrame.url,origin))throw Error('Nicht erlaubte Anfrage');};
 ipcMain.handle('pi:choose-file',async(event,kind)=>{trusted(event);const filters=kind==='session'?[{name:'OMP-Sitzung',extensions:['jsonl']}]:kind==='image'?[{name:'Bilder',extensions:['png','jpg','jpeg','webp','gif']}]:[{name:'Alle Dateien',extensions:['*']}];const result=await dialog.showOpenDialog(window,{title:'Datei auswählen',properties:['openFile'],filters});return result.canceled?null:result.filePaths[0];});
 ipcMain.handle('pi:confirm',async(event,text)=>{trusted(event);if(typeof text!=='string'||text.length>2000)throw Error('Ungültige Bestätigung');const result=await dialog.showMessageBox(window,{type:'question',message:text,buttons:['Abbrechen','Bestätigen'],defaultId:0,cancelId:0});return result.response===1;});
 ipcMain.handle('pi:clipboard-write',async(event,text)=>{trusted(event);if(typeof text!=='string'||text.length>2e6)throw Error('Text ist zu groß');clipboard.writeText(text);return true;});
 ipcMain.handle('pi:clipboard-image',event=>{trusted(event);const img=clipboard.readImage();if(img.isEmpty())return null;const bytes=img.toPNG();if(bytes.length>4000000)throw Error('Bild größer als 4 MB');return {mimeType:'image/png',data:bytes.toString('base64')};});
 ipcMain.handle('pi:reveal',async(event,file)=>{trusted(event);if(typeof file!=='string'||!path.isAbsolute(file))throw Error('Absoluter Dateipfad erforderlich');await fs.stat(file);shell.showItemInFolder(file);return true;});
 ipcMain.handle('pi:save-artifact',async(event,file)=>{trusted(event);const root=await fs.realpath(path.join(profile,'engine')),source=await fs.realpath(file);if(!source.startsWith(root+path.sep)||!(await fs.stat(source)).isFile())throw Error('Keine exportierte App-Datei');const result=await dialog.showSaveDialog(window,{title:'Export speichern',defaultPath:path.basename(source)});if(result.canceled)return null;await fs.copyFile(source,result.filePath);return result.filePath;});
 const devFeed=!app.isPackaged&&process.env.PI_DESK_UPDATE_FEED;
 if(devFeed)autoUpdater.forceDevUpdateConfig=true;
 autoUpdater.logger=updateLogger();
 updates=createUpdates({updater:autoUpdater,store:fileStore(path.join(profile,'desktop','updates.json')),current:app.getVersion(),feedURL:devFeed||UPDATE_FEED,install:installUpdate,send:status=>{if(window&&!window.isDestroyed())window.webContents.send('pi:update-status',status);}});
 ipcMain.handle('pi:update-state',event=>{trusted(event);return updates.status();});
 ipcMain.handle('pi:update-check',event=>{trusted(event);return updates.check(true);});
 ipcMain.handle('pi:update-download',event=>{trusted(event);return updates.download();});
 ipcMain.handle('pi:update-install',event=>{trusted(event);return updates.installNow();});
 ipcMain.handle('pi:update-skip',event=>{trusted(event);return updates.skip();});
 ipcMain.handle('pi:update-later',event=>{trusted(event);return updates.later();});
 ipcMain.handle('pi:update-auto',(event,value)=>{trusted(event);if(typeof value!=='boolean')throw Error('Ungültige Einstellung');return updates.setAuto(value);});
 const action=name=>()=>window.webContents.send('pi:action',name);
 Menu.setApplicationMenu(Menu.buildFromTemplate([
  {label:'Datei',submenu:[{label:'Projekt öffnen …',click:action('add-project')},{label:'Neue Aufgabe',click:action('new')},{label:'Einstellungen',accelerator:'CommandOrControl+,',click:action('settings')},{label:'Nach Updates suchen …',click:action('updates')},{type:'separator'},{label:'Beenden',accelerator:'Alt+F4',click:requestClose}]},
  {label:'Bearbeiten',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
  {label:'Ansicht',submenu:[{label:'Aufgaben suchen',click:action('search')},{label:'Dateien und Vorschau',click:action('result')},{type:'separator'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]}
 ]));
 await window.loadURL(origin);window.show();
 if(app.isPackaged||devFeed)updates.start();
}
app.on('before-quit',event=>{if(!quitting&&origin){event.preventDefault();requestClose();}});
app.on('window-all-closed',()=>{if(quitting)app.quit();});
