const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('piDesktop',Object.freeze({
 chooseFile:kind=>ipcRenderer.invoke('pi:choose-file',kind),
 confirm:text=>ipcRenderer.invoke('pi:confirm',text),
 copy:text=>ipcRenderer.invoke('pi:clipboard-write',text),
 clipboardImage:()=>ipcRenderer.invoke('pi:clipboard-image'),
 reveal:file=>ipcRenderer.invoke('pi:reveal',file),
 saveArtifact:file=>ipcRenderer.invoke('pi:save-artifact',file),
 chooseProject:()=>ipcRenderer.invoke('pi:choose-project'),
 onAction:callback=>{const handler=(_event,action)=>callback(action);ipcRenderer.on('pi:action',handler);return ()=>ipcRenderer.removeListener('pi:action',handler);}
}));
