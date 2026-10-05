const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('piDesktop',Object.freeze({
 chooseFile:kind=>ipcRenderer.invoke('pi:choose-file',kind),
 confirm:text=>ipcRenderer.invoke('pi:confirm',text),
 copy:text=>ipcRenderer.invoke('pi:clipboard-write',text),
 clipboardImage:()=>ipcRenderer.invoke('pi:clipboard-image'),
 reveal:file=>ipcRenderer.invoke('pi:reveal',file),
 saveArtifact:file=>ipcRenderer.invoke('pi:save-artifact',file),
 chooseProject:()=>ipcRenderer.invoke('pi:choose-project'),
 updates:Object.freeze({
  state:()=>ipcRenderer.invoke('pi:update-state'),
  check:()=>ipcRenderer.invoke('pi:update-check'),
  download:()=>ipcRenderer.invoke('pi:update-download'),
  install:()=>ipcRenderer.invoke('pi:update-install'),
  skip:()=>ipcRenderer.invoke('pi:update-skip'),
  later:()=>ipcRenderer.invoke('pi:update-later'),
  setAuto:value=>ipcRenderer.invoke('pi:update-auto',value),
  onStatus:callback=>{const handler=(_event,status)=>callback(status);ipcRenderer.on('pi:update-status',handler);return ()=>ipcRenderer.removeListener('pi:update-status',handler);}
 }),
 onAction:callback=>{const handler=(_event,action)=>callback(action);ipcRenderer.on('pi:action',handler);return ()=>ipcRenderer.removeListener('pi:action',handler);}
}));
