const {app,BrowserWindow,dialog}=require('electron');
const {mkdtempSync,writeFileSync,mkdirSync}=require('node:fs');
const os=require('node:os');const path=require('node:path');const assert=require('node:assert/strict');
const root=mkdtempSync(path.join(os.tmpdir(),'pi-desktop-ui-'));
process.env.PI_DESK_DESKTOP_DATA=path.join(root,'profile');
const project=path.join(root,'Projekt mit Umlauten ä');mkdirSync(project);
writeFileSync(path.join(project,'hallo.txt'),'Windows-Port: Dateivorschau');
app.setAppPath(path.resolve(__dirname,'..'));
dialog.showOpenDialog=async()=>({canceled:false,filePaths:[project]});
dialog.showErrorBox=(title,content)=>{console.error(title,content);app.exit(1);};
const timeout=setTimeout(()=>{console.error('Desktop smoke timed out');app.exit(1);},60000);
app.on('web-contents-created',(_event,web)=>{
 web.once('did-finish-load',async()=>{
  try{
   const run=code=>web.executeJavaScript(code);
   await run(`new Promise(resolve=>{const timer=setInterval(()=>{if(connected){clearInterval(timer);resolve();}},30)})`);
   assert.equal(await run('typeof window.require'),'undefined');
   assert.equal(await run('typeof window.piDesktop.chooseProject'),'function');
   assert.equal((await fetch(web.getURL()+'api/state')).status,403);
   await run("piFeatures.settingsPage('agent')");
   assert.equal(await run('document.querySelector("#f-instructions")!==null'),true);
   await run(`$('#f-instructions').value='Antworte auf Deutsch.';document.querySelector('[data-feature-form=agent]').requestSubmit()`);
   await run(`new Promise(resolve=>{const timer=setInterval(async()=>{if((await api('settings')).instructions==='Antworte auf Deutsch.'){clearInterval(timer);resolve();}},50)})`);
   await run(`$('#connect-dialog').close();perform({target:{closest:()=>({dataset:{action:'add-project'}})}})`);
   assert.equal(await run('project().name'),'Projekt mit Umlauten ä');
   await run(`setView('files')`);
   await run(`new Promise(resolve=>{const timer=setInterval(()=>{if($('#inspector-body').textContent.includes('hallo.txt')){clearInterval(timer);resolve();}},30)})`);
   await run(`selectedFile='hallo.txt';setView('preview')`);
   await run(`new Promise(resolve=>{const timer=setInterval(()=>{if($('#inspector-body').textContent.includes('Windows-Port: Dateivorschau')){clearInterval(timer);resolve();}},30)})`);
   await run(`setView('files');session.messages=[{role:'user',content:'Prüfe bitte das Projekt.'},{role:'toolResult',toolName:'read',content:'Gelesen'},{role:'toolResult',toolName:'glob',content:'Dateien erfasst'},{role:'assistant',content:'## Projekt geprüft\\n\\n**Zwei Dateien** wurden geprüft.\\n\\n\\x60\\x60\\x60js\\nconsole.log("Hallo Windows");\\n\\x60\\x60\\x60'}];renderChat();$('#toast').classList.remove('show')`);
   assert.equal(await run('document.querySelectorAll(".tool-message").length'),1);
   assert.equal(await run('document.querySelectorAll(".markdown-code").length'),1);
   assert.equal(await run(`markdown('<img src=x onerror=alert(1)>').includes('<img')`),false);
   const output=path.resolve(__dirname,'../verification');mkdirSync(output,{recursive:true});
   writeFileSync(path.join(output,'desktop.png'),(await web.capturePage()).toPNG());
   await run("piFeatures.settingsPage('agent')");writeFileSync(path.join(output,'settings.png'),(await web.capturePage()).toPNG());await run(`$('#connect-dialog').close()`);const win=BrowserWindow.fromWebContents(web);win.setSize(800,640);
   await run(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
   assert.equal(await run('document.documentElement.scrollWidth <= innerWidth'),true);
   writeFileSync(path.join(output,'compact.png'),(await web.capturePage()).toPNG());
   console.log('PASS: actual Electron window, isolated renderer, authenticated API, settings save, native picker bridge, OMP session, file preview, compact layout');
   clearTimeout(timeout);app.quit();
  }catch(e){console.error(e);clearTimeout(timeout);app.exit(1);}
 });
});
require('../desktop/main.cjs');
