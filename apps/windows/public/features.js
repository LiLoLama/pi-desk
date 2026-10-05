/* Windows feature surface. Backend operations remain explicit and authenticated. */
(() => {
 const levels=['auto','off','minimal','low','medium','high','xhigh','max'];
 const oldPerform=perform,oldSync=sync,oldSelect=selectTask,oldPending=pending,oldOnRpc=onRpc;
 let prefs={fontSize:14,reducedMotion:false,pet:false,shortcuts:{new:'Ctrl+N',open:'Ctrl+O',search:'Ctrl+K',inspector:'Ctrl+Shift+I'}},images=[],sending=false,sendMode='auto',caps={},localStatus,localPoll,ruleList=[],branchEntries=[],commandEntries=[],messageEntries=[],elapsedStart=0;
 const imageDrafts=new Map();
 const button=(action,label,id='',extra='')=>`<button type="button" class="secondary" data-feature="${action}" data-id="${esc(id)}" ${extra}>${esc(label)}</button>`;
 const field=(name,label,value='',type='text',extra='')=>`<label for="f-${name}">${esc(label)}</label><input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}>`;
 const area=(name,label,value='',extra='')=>`<label for="f-${name}">${esc(label)}</label><textarea id="f-${name}" name="${name}" rows="4" ${extra}>${esc(value)}</textarea>`;
 const select=(name,label,values,value)=>`<label for="f-${name}">${esc(label)}</label><select id="f-${name}" name="${name}">${values.map(v=>{const [id,text]=Array.isArray(v)?v:[v,v];return `<option value="${esc(id)}" ${id===value?'selected':''}>${esc(text)}</option>`;}).join('')}</select>`;
 const check=(name,label,value)=>`<label class="check-row"><input name="${name}" type="checkbox" ${value?'checked':''}>${esc(label)}</label>`;
 const form=(name,content,label='Speichern',id='')=>`<form class="settings-content feature-form" data-feature-form="${name}" data-id="${esc(id)}">${content}<div class="form-actions"><button class="primary" type="submit">${esc(label)}</button></div></form>`;
 const note=text=>`<p class="menu-note">${esc(text)}</p>`;
 const row=(title,detail,actions)=>`<div class="connection-row"><span><strong>${esc(title)}</strong><small>${esc(detail||'')}</small></span><div class="row-actions">${actions}</div></div>`;
 const val=(f,key)=>f.elements.namedItem(key)?.value||'';
 const checked=(f,key)=>!!f.elements.namedItem(key)?.checked;
 const jsonField=(f,key)=>{const text=val(f,key).trim();if(!text)return undefined;try{return JSON.parse(text);}catch{throw Error(key+': gültiges JSON eingeben.');}};
 const yes=text=>window.piDesktop?.confirm(text)??Promise.resolve(window.confirm(text));
 const pick=kind=>kind==='folder'?window.piDesktop?.chooseProject():window.piDesktop?.chooseFile(kind);
 const taskAPI=(route,body)=>{if(!task())throw Error('Zuerst eine Aufgabe öffnen.');return body===undefined?api(route+'?taskId='+encodeURIComponent(current)):api(route,{taskId:current,...body});};
 const needProject=()=>{if(!project())throw Error('Zuerst ein Projekt öffnen.');return project();};
 const choosePath=(base,name)=>base.replace(/[\\/]$/,'')+(base.includes('\\')?'\\':'/')+name;
 const contentDialog=(title,html)=>{clearInterval(localPoll);dialogContent(title,`<div id="feature-error" role="alert" hidden></div><div class="feature-content">${html}</div>`);$('#connect-dialog').classList.add('feature-dialog');};
 function showError(error){const banner=$('#feature-error');if(banner){banner.hidden=false;banner.textContent=error.message;}report(error);}
 function listing(title,rows,empty='Noch keine Einträge.'){return `<h3>${esc(title)}</h3>${rows||note(empty)}`;}
 const tabs=[['providers','Modelle & Anbieter'],['local','Lokale Modelle'],['agent','Agent'],['skills','Skills'],['mcp','MCP'],['plugins','Plugins & Hooks'],['appearance','Darstellung & Tastatur'],['rules','Projektregeln'],['worktrees','Git & Worktrees'],['updates','Updates'],['archive','Archiv & Papierkorb']];
 function settingsShell(page,html){contentDialog('Einstellungen',`<div class="settings-layout"><nav class="settings-nav" aria-label="Einstellungsbereiche">${tabs.map(([id,label])=>button('settings-page',label,id,`aria-current="${id===page?'page':'false'}"`)).join('')}</nav><section class="settings-page">${html}</section></div>`);}
 async function settingsPage(page='providers'){
  if(page==='providers'){
   savedSettings=await api('settings');
   settingsShell(page,listing('Modelle & Anbieter',savedSettings.connections.map(c=>row(c.name,c.baseUrl,`<button class="secondary" data-connection-edit="${esc(c.id)}">Bearbeiten</button><button class="secondary" data-feature="connection-remove" data-id="${esc(c.id)}">Entfernen</button>`)).join(''))+button('login','Anbieter-Abo verbinden')+' '+button('connection-new','Lokalen Server oder API hinzufügen')+note('Ollama: http://127.0.0.1:11434 · LM Studio: http://127.0.0.1:1234/v1. Die integrierte GGUF-Bibliothek findest du unter Lokale Modelle.'));
  }else if(page==='agent'){
   savedSettings=await api('settings');
   const flags={browser:'Browser-Use',browserHeadless:'Browser im Hintergrund',computer:'Computer-Use',lsp:'Sprachserver (LSP)',pty:'PTY-Sitzungen',webSearch:'Websuche',github:'GitHub-Funktionen',securityScan:'Sicherheitsprüfung',advisor:'Advisor',autoCompaction:'Automatisch komprimieren',autoRetry:'Automatisch erneut versuchen',extensions:'Automatische Erweiterungen',xdev:'Dynamische Werkzeugrouten',fastMode:'Fast-Mode',mcpProject:'MCP aus Projektkonfiguration',prewalk:'Projekt vorab durchsuchen'};
   const rules=prefs.approvals||{global:[],chats:{}};
   settingsShell(page,form('agent',area('instructions','Persönliche Hinweise',savedSettings.instructions,'maxlength="20000"')+select('thinking','Standard-Denkaufwand',levels,savedSettings.thinking)+select('memory','Memory-Backend',['off','local','hindsight','mnemopi'],savedSettings.memory)+select('steeringMode','Steering-Verarbeitung',['all','one-at-a-time'],savedSettings.steeringMode)+select('followUpMode','Warteschlangen-Verarbeitung',['all','one-at-a-time'],savedSettings.followUpMode)+select('interruptMode','Unterbrechen',['immediate','wait'],savedSettings.interruptMode)+field('browserCdpUrl','Optionaler Browser-CDP-Endpunkt',savedSettings.browserCdpUrl)+`<div class="flag-grid">${Object.entries(flags).map(([key,label])=>check(key,label,savedSettings[key])).join('')}</div>`)+listing('Automatische Genehmigungen',note(`Global: ${rules.global.join(', ')||'keine'} · Chatregeln: ${Object.keys(rules.chats).length}`))+button('approvals-clear','Alle gemerkten Freigaben zurücksetzen')+note('Änderungen werden übernommen, sobald alle Agenten und Anmeldungen im Leerlauf sind.'));
  }else if(['skills','mcp','plugins'].includes(page)){
   caps=await api('capabilities');
   if(page==='skills')settingsShell(page,listing('Skills',caps.skills.map(s=>row(s.name,s.error||s.description||s.path,button('skill-preview','Ansehen',s.id)+button('skill-toggle',s.enabled?'Deaktivieren':'Aktivieren',s.id)+button('skill-remove','Trennen',s.id))).join(''))+button('skill-add','Skill-Ordner verbinden')+button('runtime-caps','Geladene Werkzeuge prüfen')+note('Neue Skills sind ausgeschaltet. Trennen lässt die Originaldateien unverändert.'));
   if(page==='mcp')settingsShell(page,listing('MCP-Server',caps.servers.map(s=>row(s.name,`${s.type} · ${s.enabled?'aktiv':'aus'} · ${s.url||s.command}`,button('mcp-edit','Bearbeiten',s.name)+button('mcp-test','Testen',s.name)+button('mcp-toggle',s.enabled?'Deaktivieren':'Aktivieren',s.name)+button('mcp-remove','Entfernen',s.name))).join(''))+button('mcp-new','Server hinzufügen')+note('stdio, HTTP und SSE. Zugangsdaten werden nicht erneut angezeigt. Neue OAuth-Anmeldungen sind noch nicht angebunden.'));
   if(page==='plugins')settingsShell(page,listing('Lokale Plugins',caps.plugins.map(p=>row(p.name,p.error||p.path,button('plugin-toggle',p.enabled?'Deaktivieren':'Aktivieren',p.id)+button('plugin-remove','Trennen',p.id))).join(''))+button('plugin-add','Plugin-Ordner verbinden')+listing('Hooks',caps.hooks.map(p=>row(p.name,p.error||p.path,button('hook-toggle',p.enabled?'Deaktivieren':'Aktivieren',p.id)+button('hook-remove','Trennen',p.id))).join(''))+button('hook-add','Hook-Datei verbinden')+listing('Installierte Pakete',caps.installed.map(p=>row(p.name,p.version+' · '+p.source,button('installed-toggle',p.enabled?'Deaktivieren':'Aktivieren',p.name))).join(''))+form('plugin-install',field('target','npm-Paket, Git-Quelle oder lokaler Pfad','','text','required'),'Installieren')+form('marketplace',field('source','Marketplace-Quelle','','text','required'),'Quelle hinzufügen')+note('Plugins und Hooks führen lokalen Code aus. npm-/Marketplace-Funktionen können Bun im PATH benötigen.'));
  }else if(page==='appearance'){
   prefs=await api('desktop-settings');
   settingsShell(page,form('appearance',field('fontSize','Chat-Schriftgröße',prefs.fontSize,'number','min="12" max="24" required')+check('reducedMotion','Bewegung reduzieren',prefs.reducedMotion)+check('pet','Pi-Begleiter anzeigen',prefs.pet)+Object.entries({new:'Neue Aufgabe',open:'Projekt öffnen',search:'Suche',inspector:'Dateien/Vorschau'}).map(([key,label])=>field(key,label,prefs.shortcuts[key],'text','required')).join('')+note('Format: Ctrl+N oder Ctrl+Shift+N. Doppelte Belegungen und Standardbearbeitungsbefehle werden abgewiesen.')));
  }else if(page==='rules'){
   ruleList=(await api('rules?projectId='+needProject().id)).files;
   settingsShell(page,form('rules',select('name','Regeldatei',ruleList.map(f=>[f.name,f.name+(f.exists?'':' · neu')]),ruleList[0].name)+area('text','Projekthinweise',ruleList[0].text,'maxlength="200000" rows="15"')+note('Ein leerer Text entfernt die gewählte Regeldatei. Bestehende Dateien werden erst mit Speichern verändert.')));
  }else if(page==='worktrees'){
   const git=await api('git?projectId='+needProject().id);
   settingsShell(page,listing('Git',note(git.branch||'Detached HEAD')+`<pre>${esc(git.status||'Keine Änderungen')}</pre>`)+listing('Worktrees',git.worktrees.map(w=>row(w.branch||'Detached',w.path,button('worktree-open','Als Projekt öffnen',w.path)+(w.path===git.repo?'':button('worktree-remove','Entfernen',w.path)))).join(''))+form('worktree',field('path','Neuer Zielordner','','text','required')+button('worktree-parent','Übergeordneten Ordner auswählen')+field('branch','Neuer Branch (optional)')+field('commit','Ausgangspunkt (optional)','HEAD')+check('detach','Ohne Branch (detached)',false),'Worktree anlegen')+note('Entfernen ist nur für unveränderte Worktrees erlaubt. Git muss installiert sein.'));
  }else if(page==='archive'){
   state=await api('state');
   settingsShell(page,listing('Archiv',state.tasks.filter(t=>t.archivedAt&&!t.deletedAt).map(t=>row(t.title,'',button('task-restore','Wiederherstellen',t.id)+button('task-trash','In Papierkorb',t.id))).join(''))+listing('Papierkorb',state.tasks.filter(t=>t.deletedAt).map(t=>row(t.title,'',button('task-restore','Wiederherstellen',t.id)+button('task-purge','Endgültig löschen',t.id))).join(''))+button('trash-empty','Papierkorb leeren'));
  }else if(page==='updates'){
   const u=window.piDesktop?.updates;
   if(!u)return settingsShell(page,note('Updates sind nur in der Desktop-App verfügbar.'));
   const s=await u.state();
   settingsShell(page,listing('Updates',row('Installierte Version',s.current,'')+row('Letzte Prüfung',s.lastCheck?new Date(s.lastCheck).toLocaleString('de-DE'):'Noch nicht geprüft',''))+`<label class="check-row"><input type="checkbox" data-update-auto ${s.auto?'checked':''}>Automatisch nach Updates suchen</label>`+button('update-check','Jetzt nach Updates suchen')+(s.phase==='upToDate'?note(`Pi Desk ${s.current} ist aktuell.`):'')+(s.phase==='error'?`<p class="error-line">${esc(s.error)}</p>`:'')+note('Pi Desk sucht beim Start und danach alle 6 Stunden. Vor jeder Installation siehst du, was neu ist.'));
  }else if(page==='local')return showLocal();
 }
 openSettings=()=>settingsPage();showArchive=()=>settingsPage('archive');
 function mcpEditor(name){
  const s=caps.servers?.find(s=>s.name===name)||{type:'stdio',args:[],enabled:false};
  contentDialog(name?'MCP-Server bearbeiten':'MCP-Server hinzufügen',form('mcp',field('name','Name',s.name||'','text',name?'readonly':'required')+select('type','Verbindungstyp',['stdio','http','sse'],s.type)+field('command','Programm (stdio)',s.command||'')+area('args','Argumente als JSON-Liste',JSON.stringify(s.args||[]))+field('cwd','Arbeitsordner (optional)',s.cwd||'')+field('url','URL (HTTP/SSE)',s.url||'')+area('env','Umgebungsvariablen als JSON-Objekt','')+area('headers','HTTP-Header als JSON-Objekt','')+note(`Gespeicherte Variablen: ${(s.envKeys||[]).join(', ')||'keine'}. Header: ${(s.headerKeys||[]).join(', ')||'keine'}. Leer lassen behält Werte; {} entfernt sie.`)+check('enabled','Aktivieren',s.enabled),'Speichern',name||''));
 }
 async function showLocal(){
  localStatus=await api('local-models');const s=localStatus;
  settingsShell('local',`<h3>Lokale Modellbibliothek</h3>${note('GGUF direkt in Pi Desk laden. CPU funktioniert ohne separaten GPU-Dienst; Vulkan benötigt einen passenden Grafiktreiber. MLX ist unter Windows nicht ausführbar.')}${select('engineBackend','Windows-Engine',[['cpu','CPU'],['vulkan','Vulkan (GPU)']],s.backend)}${button('local-backend','Engine-Auswahl speichern')}${button('local-scan','Bibliothek aktualisieren')}${listing('Modellordner',s.folders.map(p=>row(p,'',button('local-folder-remove','Trennen',p))).join(''))}${button('local-folder-add','Modellordner verbinden')}${s.suggested.map(p=>button('local-folder-suggested','Verbinden: '+p,p)).join('')}${listing('Modelle',s.models.map(m=>row(m.name,`${m.format.toUpperCase()} · ${(m.bytes/1024**3).toFixed(1)} GB · ${m.fit}${m.context.max?' · trainiert bis '+tokens(m.context.max):''}`,contextSelect(m,s)+button('local-start','Laden',m.id,m.format==='mlx'&&s.platform==='win32'?'disabled':'')+(s.active?.id===m.id?button('local-use','Im Chat verwenden')+button('local-stop','Entladen'):''))).join(''))}${note(`Kontextlänge je Modell: Die Angaben schätzen Modell plus Kontextspeicher bei ${Math.round(s.memory/1024**3)} GB Arbeitsspeicher; mit Vulkan zählt zusätzlich der Grafikspeicher. Was voraussichtlich nicht passt, ist gesperrt. Der Agent braucht allein für Anweisungen und Werkzeuge rund 10k Tokens. Änderungen gelten beim nächsten Laden.`)}${s.errors.map(e=>note(e.path+': '+e.message)).join('')}<div id="local-progress" role="status"></div><h3>Modelle entdecken</h3>${form('catalog',field('query','Hugging-Face-Suche','Qwen')+select('format','Format',s.platform==='win32'?['gguf']:['gguf','mlx'],'gguf'),'Suchen')}<div id="catalog-results"></div>`);
  renderLocalProgress(s);localPoll=setInterval(async()=>{if(!$('#local-progress')||!$('#connect-dialog').open){clearInterval(localPoll);return;}try{const next=await api('local-models');const finished=localStatus.job?.running&&!next.job?.running;localStatus=next;renderLocalProgress(next);if(finished)await showLocal();}catch(e){showError(e);}},1200);
 }
 const tokens=n=>n>=1048576?(n/1048576).toLocaleString('de-DE')+'M':Math.round(n/1024)+'k';
 const contextLabel=o=>`${tokens(o.size)} Tokens · ${o.bytes?'ca. '+(o.bytes/1024**3).toLocaleString('de-DE',{maximumFractionDigits:1})+' GB':'Bedarf unbekannt'}${{tight:' · knapp','too-large':' · zu groß für dieses Gerät'}[o.fit]||''}${o.tooSmall?' · zu klein für den Agenten':''}`;
 const contextSelect=(m,s)=>`<select data-context-model="${esc(m.id)}" aria-label="Kontextlänge für ${esc(m.name)}" ${s.active?.id===m.id&&s.active.state==='ready'||s.job?.running?'disabled':''}>${m.context.options.map(o=>`<option value="${o.size}" ${o.size===m.context.size?'selected':''} ${o.disabled?'disabled':''}>${esc(contextLabel(o))}</option>`).join('')}</select>`;
 function renderLocalProgress(s){const el=$('#local-progress');if(!el)return;el.innerHTML=(s.active?row(s.active.name,`${s.active.state}${s.active.error?' · '+s.active.error:''}`,button('local-use','Im Chat verwenden')+button('local-stop','Entladen')):'')+(s.job?`<p>${esc(s.job.error||s.job.label)} ${s.job.total?Math.round(s.job.done/s.job.total*100)+' %':''}</p>${s.job.running?button('local-cancel','Vorgang abbrechen'):''}`:'');}
 let downloadInfo;
 async function catalogDetails(repo,format){downloadInfo=await api('local-models/files?repo='+encodeURIComponent(repo)+'&format='+format);contentDialog(repo,form('download',note(`Revision ${downloadInfo.revision.slice(0,12)} · Lizenz: ${downloadInfo.license}`)+select('filename','Datei',downloadInfo.files.map(f=>[f.name,`${f.name} · ${(f.variantBytes/1024**3).toFixed(1)} GB`]),downloadInfo.files.find(f=>/Q4_K_M/.test(f.name))?.name||downloadInfo.files[0]?.name)+select('destination','Zielordner',localStatus.folders,localStatus.folders[0])+`<input type="hidden" name="format" value="${esc(format)}">`,'Herunterladen'));}
 async function refreshSession(){if(!task())return;const result=await taskAPI('session');session=result;Object.assign(task(),result.task);renderNav();renderChat();sync();}
 function more(anchor){pop(`<div class="menu-title">Aufgabe</div><button class="menu-option" data-action="rename">Umbenennen</button>${[['thinking','Denkaufwand'],['session-tools','Sitzung & Befehle'],['runtime','Todos & Subagenten'],['worktrees','Git & Worktrees'],['rules','Projektregeln'],['import','Sitzung importieren'],['export','HTML exportieren'],['handoff','Handoff erstellen'],['branch','Verzweigen'],['task-trash','In Papierkorb'],['settings-archive','Archiv & Papierkorb']].map(([id,label])=>button(id,label)).join('')}<button class="menu-option" data-action="archive-task">Archivieren</button>`,anchor);}
 async function sessionTools(){const s=await taskAPI('session');session=s;contentDialog('Sitzung & Befehle',form('thinking',select('level','Denkaufwand',levels,s.thinkingLevel),'Übernehmen')+button('fast',s.runtime?.fastModeEnabled?'Fast-Mode ausschalten':'Fast-Mode einschalten')+' '+button('cycle-model','Nächstes Modell')+listing('Kontext',note(JSON.stringify(s.runtime?.contextUsage||{})))+button('stats','Sitzungsstatistik')+form('compact',area('instructions','Hinweise für Komprimierung (optional)'),'Kontext komprimieren')+button('commands','Befehlspalette')+' '+button('abort-retry','Wiederholungsversuch abbrechen')+' '+button('new-session','Sitzung zurücksetzen')+' '+button('share','Sitzung über OMP teilen')+form('bash',area('command','Shell-Befehl','','required'),'Befehl ausführen')+button('bash-abort','Shell-Befehl abbrechen'));}
 async function showRuntime(){const s=await taskAPI('session');session=s;contentDialog('Todos & Subagenten',listing('Aufgabenplan',(s.todos||[]).map((p,pi)=>`<h4>${esc(p.name||'Phase')}</h4>${(p.tasks||[]).map((t,ti)=>row(t.content,t.status,button('todo-toggle',t.status==='completed'?'Wieder öffnen':'Erledigt',pi+':'+ti))).join('')}`).join(''))+form('todos',area('phases','Aufgabenplan als JSON',JSON.stringify(s.todos||[],null,2)),'Plan speichern')+listing('Subagenten',(s.subagents||[]).map(a=>row(a.name||a.id||a.agentId||'Subagent',a.status||a.state||'',button('subagent-view','Verlauf',a.id||a.agentId||a.subagentId||''))).join('')));}
 async function sendCurrent(mode=sendMode){
  if(sending||!task())return;
  const message=$('#prompt').value.trim();if(!message&&!images.length)return;
  const id=current,originalText=$('#prompt').value,submittedImages=[...images],submittedContext=[...context];sending=true;sync();
  try{await api(mode==='steer'&&session.busy?'steer':mode==='interrupt'&&session.busy?'abort-and-prompt':session.busy?'follow-up':'prompt',{taskId:id,message,context:submittedContext,images:submittedImages});drafts.delete(id);imageDrafts.delete(id);if(current===id&&$('#prompt').value===originalText){$('#prompt').value='';context=[];images=[];}}finally{sending=false;sendMode='auto';sync();}
 }
 selectTask=async id=>{if(current)imageDrafts.set(current,[...images]);images=imageDrafts.get(id)||[];return oldSelect(id);};
 function addImage(image){if(!image)return;if(!['image/png','image/jpeg','image/gif','image/webp'].includes(image.mimeType))throw Error('PNG, JPEG, GIF oder WebP verwenden.');if(images.length>=4)throw Error('Maximal vier Bilder.');if(image.data.length*0.75>4000000||images.reduce((n,i)=>n+i.data.length*0.75,0)+image.data.length*0.75>8000000)throw Error('Bilder: maximal 4 MB je Bild und 8 MB insgesamt.');images.push(image);sync();}
 $('#prompt').addEventListener('paste',e=>{const file=[...(e.clipboardData?.items||[])].find(i=>i.type.startsWith('image/'))?.getAsFile();if(!file)return;e.preventDefault();file.arrayBuffer().then(b=>{let binary='';for(const c of new Uint8Array(b))binary+=String.fromCharCode(c);addImage({mimeType:file.type,data:btoa(binary)});}).catch(showError);});
 document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&e.altKey&&!e.isComposing&&e.target===$('#prompt')){e.preventDefault();e.stopImmediatePropagation();sendCurrent('steer').catch(showError);return;}
  if(!e.ctrlKey||e.metaKey||e.isComposing)return;
  const combo='Ctrl+'+(e.shiftKey?'Shift+':'')+(e.altKey?'Alt+':'')+e.key.toUpperCase();
  const action=Object.keys(prefs.shortcuts).find(k=>prefs.shortcuts[k]===combo);if(!action)return;
  e.preventDefault();e.stopImmediatePropagation();const map={new:'new',open:'add-project',search:'search',inspector:'result'};perform({target:{closest:()=>({dataset:{action:map[action]}})}}).catch(showError);
 },true);
 function applyAppearance(){document.documentElement.style.setProperty('--chat-font-size',prefs.fontSize+'px');document.body.classList.toggle('reduce-motion',prefs.reducedMotion);$('#pi-pet').hidden=!prefs.pet;}
 sync=()=>{oldSync();$('#send').disabled=sending||!task()||!connected||(!$('#prompt').value.trim()&&!images.length);$('#image-attachments').innerHTML=images.map((i,n)=>`<div class="image-chip"><img src="data:${esc(i.mimeType)};base64,${i.data}" alt="Bildanhang ${n+1}"><button type="button" class="icon" data-feature="image-remove" data-id="${n}" aria-label="Bild entfernen">${icon('close')}</button></div>`).join('');$('#queued').innerHTML=(session.queue||[]).map(q=>row(q.text,q.kind==='steer'?'Eingreifen':'Wartet',q.kind==='follow-up'?button('queue-remove','Entfernen',q.id):'')).join('');$('#thinking-value').textContent=session.thinkingLevel||'Aufwand';$('#steer-send').hidden=!session.busy;$('#interrupt-send').hidden=!session.busy;$('#runtime-open').hidden=!task();$('#pi-pet').classList.toggle('working',!!session.busy);$('#pi-pet').title=session.pending?.length?'Wartet auf Genehmigung':session.busy?'Pi arbeitet':'Pi ist bereit';if(session.busy&&!elapsedStart)elapsedStart=Date.now();if(!session.busy)elapsedStart=0;};
 pending=()=>{oldPending();for(const el of $('#live-pending').querySelectorAll('[data-request]')){if(el.querySelector('.approval-scopes'))continue;const request=session.pending.find(p=>p.id===el.dataset.request);if(!request||!approvalTool(request))continue;el.insertAdjacentHTML('beforeend',`<div class="approval-scopes">${button('approve-chat','Für diesen Chat erlauben',request.id)} ${button('approve-global','Werkzeug global erlauben',request.id)}</div>`);}};
 function approvalTool(r){const text=[r.title,r.message].filter(Boolean).join('\n');if(!(r.method==='confirm'||r.method==='select'&&r.options?.includes('Approve'))||/provider safety checks:/i.test(text))return '';return text.split('\n').map(s=>s.match(/^Allow tool: ([\w.-]{1,160})\s*$/)?.[1]).find(Boolean)||'';}
 onRpc=(id,f)=>{oldOnRpc(id,f);if(id===current&&f.type==='command_output'&&(f.text||f.message)){session.messages.push({role:'assistant',content:String(f.text||f.message),timestamp:Date.now()});schedule();}if(id===current&&f.type==='agent_end'&&f.isTerminal!==false)refreshSession().catch(showError);};
 const safeMarkdown=text=>{
  const html=DOMPurify.sanitize(marked.parse(String(text),{gfm:true,breaks:true}),{ALLOWED_TAGS:['p','br','h1','h2','h3','h4','h5','h6','strong','em','del','ul','ol','li','blockquote','pre','code','table','thead','tbody','tr','th','td','a','hr'],ALLOWED_ATTR:['href','title'],ALLOW_DATA_ATTR:false,ALLOW_ARIA_ATTR:false});
  const holder=document.createElement('div');holder.innerHTML=html;
  for(const a of holder.querySelectorAll('a')){const href=a.getAttribute('href')||'';if(/^https?:\/\//i.test(href)){a.target='_blank';a.rel='noopener noreferrer';}else if(href&&!/^[a-z][a-z0-9+.-]*:/i.test(href)&&!href.startsWith('//')&&!href.startsWith('#')){a.dataset.feature='file-link';a.dataset.id=href;a.removeAttribute('href');a.setAttribute('role','button');a.tabIndex=0;}else{a.removeAttribute('href');}}
  holder.querySelectorAll('pre').forEach(p=>p.classList.add('markdown-code'));return holder.innerHTML;
 };
 markdown=safeMarkdown;
 renderMessages=messages=>{
  messageEntries=messages;let html='',tools=[];
  const flush=()=>{if(tools.length){html+=`<details class="tool-message"><summary>Arbeit · ${tools.length} Schritte</summary>${tools.map(m=>`<strong>${esc(m.toolName||'Werkzeug')}${m.isError?' · Fehlgeschlagen':''}</strong><pre>${esc(messageText(m))}</pre>`).join('')}</details>`;tools=[];}};
  messages.forEach((m,index)=>{if(m.role==='toolResult'){tools.push(m);return;}flush();if(!['user','assistant'].includes(m.role))return;const text=messageText(m).split('\n\n[Angehängter Dateikontext')[0];const thinking=Array.isArray(m.content)?m.content.filter(c=>c.type==='thinking').map(c=>c.thinking||c.text||'').join('\n'):'';const pics=Array.isArray(m.content)?m.content.filter(c=>c.type==='image'&&/^image\/(png|jpeg|webp|gif)$/.test(c.mimeType||'')&&/^[A-Za-z0-9+/=]+$/.test(c.data||'')):[];if(!text&&!thinking&&!pics.length)return;html+=`<div class="message ${m.role}">${thinking?`<details class="reasoning"><summary>Denkprozess</summary>${safeMarkdown(thinking)}</details>`:''}${text?(m.role==='user'?'<p>'+esc(text)+'</p>':safeMarkdown(text)):''}${pics.map(i=>`<img class="message-image" src="data:${i.mimeType};base64,${i.data}" alt="Gesendetes Bild">`).join('')}<div class="message-actions">${m.timestamp?`<time>${esc(new Date(m.timestamp).toLocaleTimeString('de',{hour:'2-digit',minute:'2-digit'}))}</time>`:''}${button('message-copy','Kopieren',index)}${button(m.role==='user'?'message-edit':'message-continue',m.role==='user'?'Bearbeiten':'In neuem Chat fortfahren',index)}</div></div>`;});flush();return html;
 };
 const updateDialog=()=>{let d=$('#update-dialog');if(!d){d=document.createElement('dialog');d.id='update-dialog';d.className='connect-dialog update-dialog';d.setAttribute('aria-label','Pi Desk aktualisieren');d.addEventListener('cancel',e=>{e.preventDefault();dismissUpdate().catch(report);});document.body.append(d);}return d;};
 const closeUpdate=()=>{const d=$('#update-dialog');if(d?.open)d.close();};
 // Closing a result dialog (not ready/downloading) also resets the main-side phase to idle.
 const dismissUpdate=()=>{const x=$('#update-dialog')?.querySelector('.dialog-head [data-feature]');return x?action(x.dataset.feature,'',x):undefined;};
 let updatePhase='',downloadHidden=false;
 // Release notes are remote text: relative links must not become project file-link buttons.
 const updateNotes=text=>{const h=document.createElement('div');h.innerHTML=safeMarkdown(text);h.querySelectorAll('[data-feature="file-link"]').forEach(a=>a.replaceWith(a.textContent));return h.innerHTML;};
 function showUpdate(s){
  updatePhase=s.phase;
  const head=(title,close='update-later')=>`<div class="dialog-head"><h2>${esc(title)}</h2><button class="icon" data-feature="${close}" aria-label="Schließen">${icon('close')}</button></div>`;
  let html;
  if(s.phase==='available')html=head(`Pi Desk ${s.version} ist verfügbar`)+`<p class="menu-note">Du hast ${esc(s.current)}.</p><div class="update-notes">${updateNotes(s.notes)}</div><div class="form-actions">${button('update-skip','Diese Version überspringen')}<span class="update-spacer"></span>${button('update-later','Später')}<button type="button" class="primary" data-feature="update-download">Jetzt aktualisieren</button></div>`;
  else if(s.phase==='downloading')html=head('Update wird geladen','update-close-ready')+`<progress max="100" value="${Number(s.percent)||0}"></progress><p class="menu-note">${Number(s.percent)||0} %</p>`;
  else if(s.phase==='ready')html=head(`Pi Desk ${s.version} ist bereit`,'update-close-ready')+`<p>Ein Vorgang läuft noch. Das Update wird beim nächsten Beenden installiert.</p><div class="form-actions">${button('update-close-ready','Beim Beenden installieren')}<button type="button" class="primary" data-feature="update-install">Jetzt neu starten</button></div>`;
  else if(s.phase==='upToDate')html=head('Keine Updates')+`<p>Pi Desk ${esc(s.current)} ist aktuell.</p><div class="form-actions"><span class="update-spacer"></span><button type="button" class="primary" data-feature="update-close">OK</button></div>`;
  else if(s.phase==='error')html=head('Update nicht möglich')+`<p class="error-line">${esc(s.error)}</p><div class="form-actions">${button('update-close','Schließen')}<button type="button" class="primary" data-feature="update-check">Erneut versuchen</button></div>`;
  else return closeUpdate();
  const d=updateDialog();d.innerHTML=html;if(!d.open)d.showModal();
 }
 async function action(name,id,el){
  $('#popover').hidePopover();
  if(name==='settings-page')return settingsPage(id);
  if(name==='update-check')return window.piDesktop.updates.check();
  if(name==='update-download')return window.piDesktop.updates.download();
  if(name==='update-install')return window.piDesktop.updates.install();
  if(name==='update-skip'){closeUpdate();return window.piDesktop.updates.skip();}
  if(name==='update-later'||name==='update-close'){closeUpdate();return window.piDesktop.updates.later();}
  if(name==='update-close-ready'){if(updatePhase==='downloading')downloadHidden=true;return closeUpdate();}
  if(name==='login')return connect();
  if(name==='connection-new'){savedSettings=await api('settings');return editConnection();}
  if(name==='connection-remove'){if(await yes('Diese Verbindung entfernen? Der gespeicherte Schlüssel wird ebenfalls entfernt.'))await api('settings/connection-remove',{id});return settingsPage();}
  if(name==='approvals-clear'){if(await yes('Alle gemerkten Werkzeugfreigaben zurücksetzen?'))prefs=await api('approvals-clear',{});return settingsPage('agent');}
  if(name==='skill-add'||name==='plugin-add'||name==='hook-add'){const file=await pick(name==='hook-add'?'file':'folder');if(file)await api('capabilities/'+name,{path:file});return settingsPage(name==='skill-add'?'skills':'plugins');}
  const match=name.match(/^(skill|plugin|hook)-(toggle|remove)$/);
  if(match){const [_,kind,op]=match;const item=caps[kind==='skill'?'skills':kind==='hook'?'hooks':'plugins'].find(x=>x.id===id);if(op==='remove'&&!await yes('Verknüpfung trennen? Originaldateien bleiben erhalten.'))return;await api('capabilities/'+kind+'-state',{id,enabled:!item.enabled,remove:op==='remove'});return settingsPage(kind==='skill'?'skills':'plugins');}
  if(name==='skill-preview'){const s=await api('capabilities/preview?id='+encodeURIComponent(id));return contentDialog(s.name,`<pre>${esc(s.text)}</pre>`);}
  if(name==='runtime-caps'){const result=await api('capabilities/runtime?taskId='+current);return contentDialog('Geladene Skills & MCP-Werkzeuge',`<pre>${esc(JSON.stringify(result,null,2))}</pre>`);}
  if(name==='mcp-new')return mcpEditor();if(name==='mcp-edit')return mcpEditor(id);
  if(name==='mcp-test'){const r=await api('capabilities/mcp-test',{name:id});toast(r.message);return;}
  if(name==='mcp-toggle'||name==='mcp-remove'){const s=caps.servers.find(s=>s.name===id);if(name==='mcp-remove'&&!await yes('MCP-Server und gespeicherte Zugangsdaten entfernen?'))return;await api('capabilities/mcp-state',{name:id,enabled:!s.enabled,remove:name==='mcp-remove'});return settingsPage('mcp');}
  if(name==='installed-toggle'){const p=caps.installed.find(p=>p.name===id);await api('capabilities/plugin-installed',{name:id,enabled:!p.enabled});return settingsPage('plugins');}
  if(name==='worktrees'||name==='rules')return settingsPage(name);
  if(name==='worktree-parent'){const parent=await pick('folder');if(parent)$('#f-path').value=choosePath(parent,'neuer-worktree');return;}
  if(name==='worktree-open'){const p=await api('projects',{path:id});$('#connect-dialog').close();return newTask(p.id);}
  if(name==='worktree-remove'){if(!await yes('Diesen unveränderten Worktree entfernen? Die Dateien im Worktree werden entfernt.'))return;await api('worktrees',{projectId:needProject().id,path:id,remove:true});return settingsPage('worktrees');}
  if(name==='settings-archive')return settingsPage('archive');
  if(name.startsWith('task-')||name==='trash-empty'){
   const taskId=id||current,operation=name==='trash-empty'?'empty':name.slice(5);
   if(['purge','empty'].includes(operation)&&!await yes(operation==='empty'?'Alle Chats im Papierkorb endgültig löschen? Sitzungsdateien werden gelöscht, Projektdateien bleiben.':'Diesen Chat und seine Sitzungsdatei endgültig löschen? Projektdateien bleiben.'))return;
   if(operation==='trash'&&!await yes('Aufgabe in den Papierkorb verschieben? Sie kann wiederhergestellt werden.'))return;
   await api('task-state',{taskId,action:operation});state=await api('state');if(taskId===current&&operation!=='restore'){current='';session={messages:[],pending:[]};renderChat();sync();}renderNav();return settingsPage('archive');
  }
  if(name==='local-scan'){await api('local-models/scan',{});return showLocal();}
  if(name==='local-backend'){await api('local-models/backend',{backend:$('#f-engineBackend').value});return showLocal();}
  if(name==='local-folder-add'||name==='local-folder-suggested'){const folder=id||await pick('folder');if(folder)await api('local-models/folder',{path:folder});return showLocal();}
  if(name==='local-folder-remove'){await api('local-models/folder',{path:id,remove:true});return showLocal();}
  if(name==='local-start'){await api('local-models/start',{id});return showLocal();}
  if(name==='local-stop'){await api('local-models/stop',{});return showLocal();}
  if(name==='local-cancel'){await api('local-models/cancel',{});return;}
  if(name==='local-use'){await taskAPI('model',{provider:'pi-desk-local',modelId:'local'});$('#connect-dialog').close();return refreshSession();}
  if(name==='catalog-detail')return catalogDetails(id,el.dataset.format);
  if(name==='thinking'){contentDialog('Denkaufwand',form('thinking',select('level','Für diesen Chat',levels,session.thinkingLevel||'auto'),'Übernehmen'));return;}
  if(name==='session-tools')return sessionTools();if(name==='runtime')return showRuntime();
  if(name==='fast'){await taskAPI('fast-mode',{enabled:!session.runtime?.fastModeEnabled});return sessionTools();}
  if(name==='cycle-model'){await taskAPI('cycle-model',{});await refreshSession();toast('Modell gewechselt');return;}
  if(name==='stats'){const s=await taskAPI('stats');contentDialog('Sitzungsstatistik',`<pre>${esc(JSON.stringify(s,null,2))}</pre>`);return;}
  if(name==='abort-retry'||name==='bash-abort'){await taskAPI(name==='bash-abort'?'bash':name,name==='bash-abort'?{abort:true}:{});toast('Abbruch angefordert');return;}
  if(name==='new-session'){if(!await yes('Aktuelle Unterhaltung zurücksetzen? Die Aufgabe erhält eine neue leere Sitzung.'))return;await taskAPI('new-session',{});$('#connect-dialog').close();return refreshSession();}
  if(name==='export'||name==='handoff'){const r=await taskAPI(name,{});if(r.path){const saved=await window.piDesktop?.saveArtifact(r.path);toast(saved?'Gespeichert: '+saved:'Export liegt unter '+r.path);}return;}
  if(name==='import'){const file=await pick('session');if(file){const t=await api('tasks',{projectId:needProject().id,sessionFile:file});state=await api('state');await selectTask(t.id);}return;}
  if(name==='share'){if(!await yes('Diese Unterhaltung über den OMP-Share-Dienst veröffentlichen? Inhalte verlassen den Rechner.'))return;const r=await taskAPI('share',{});contentDialog('Geteilte Sitzung',`<pre>${esc(r.link||r.output)}</pre>`+button('copy-text','Link kopieren',r.link));return;}
  if(name==='commands'){const r=await taskAPI('commands');commandEntries=r.commands||[];contentDialog('Befehlspalette',field('commandFilter','Befehl suchen')+`<div id="command-list">${commandEntries.map((c,n)=>row(c.name,c.description,button('command-use','Einfügen',n))).join('')}</div>`);return;}
  if(name==='command-use'){const c=commandEntries[Number(id)];$('#prompt').value='/'+c.name.replace(/^\//,'')+' ';$('#connect-dialog').close();$('#prompt').focus();sync();return;}
  if(name==='branch'){const r=await taskAPI('branches');branchEntries=r.messages||r.entries||[];contentDialog('Unterhaltung verzweigen',branchEntries.map((m,n)=>row(m.text||m.content||m.preview||m.id,'',button('branch-at','Hier verzweigen',n))).join('')||note('Noch keine Verzweigungspunkte.'));return;}
  if(name==='branch-at'){const m=branchEntries[Number(id)];const t=await taskAPI('branch',{entryId:m.id||m.entryId});state=await api('state');$('#connect-dialog').close();return selectTask(t.id);}
  if(name==='subagent-view'){const r=await api('subagent-messages?taskId='+current+'&subagentId='+encodeURIComponent(id));contentDialog('Subagentenverlauf',`<pre>${esc(JSON.stringify(r,null,2))}</pre>`);return;}
  if(name==='todo-toggle'){const [pi,ti]=id.split(':').map(Number),phases=structuredClone(session.todos);const t=phases[pi].tasks[ti];t.status=t.status==='completed'?'pending':'completed';await taskAPI('todos',{phases});return showRuntime();}
  if(name==='image-clipboard'){addImage(await window.piDesktop?.clipboardImage());return;}
  if(name==='image-remove'){images.splice(Number(id),1);sync();return;}
  if(name==='context-file'){const file=await pick('file');if(!file)return;const base=needProject().path.replaceAll('\\','/').replace(/\/$/,'')+'/',normalized=file.replaceAll('\\','/');if(!normalized.toLowerCase().startsWith(base.toLowerCase()))throw Error('Bitte eine Datei innerhalb des Projekts wählen.');const rel=normalized.slice(base.length);if(context.length>=10)throw Error('Maximal zehn Kontextdateien');await api('file?projectId='+project().id+'&path='+encodeURIComponent(rel));if(!context.includes(rel))context.push(rel);sync();return;}
  if(name==='queue-remove'){await taskAPI('queue-remove',{id});return;}
  if(name==='steer-send'||name==='interrupt-send')return sendCurrent(name==='steer-send'?'steer':'interrupt');
  if(name==='approve-chat'||name==='approve-global'){const r=session.pending.find(p=>p.id===id);if(!r||!approvalTool(r))throw Error('Keine merkbare Werkzeugfreigabe.');if(name==='approve-global'&&!await yes('Werkzeug '+approvalTool(r)+' in allen Chats automatisch erlauben? In den Einstellungen lässt sich diese Freigabe zurücksetzen.'))return;await api('respond',{taskId:current,id,scope:name==='approve-chat'?'chat':'global',...(r.method==='confirm'?{confirmed:true}:{value:'Approve'})});session.pending=session.pending.filter(p=>p.id!==id);prefs=await api('desktop-settings');pending();return;}
  if(name==='message-copy'||name==='copy-text'){const text=name==='copy-text'?id:messageText(messageEntries[Number(id)]);await window.piDesktop?.copy(text);toast('Kopiert');return;}
  if(name==='message-edit'){const m=messageEntries[Number(id)];$('#prompt').value=messageText(m).split('\n\n[Angehängter Dateikontext')[0];images=(Array.isArray(m.content)?m.content:[]).filter(c=>c.type==='image').map(c=>({mimeType:c.mimeType,data:c.data}));$('#prompt').focus();sync();toast('Nachricht zum Bearbeiten übernommen; Senden fügt eine neue Nachricht hinzu.');return;}
  if(name==='message-continue'){const text=messageText(messageEntries[Number(id)]);await newTask(needProject().id);$('#prompt').value='Setze diese Antwort fort:\n\n'+text;sync();$('#prompt').focus();return;}
  if(name==='file-link'){let rel=decodeURIComponent(id).replace(/:\d+(?::\d+)?$/,'').replace(/#L\d+$/,'');const p=needProject();if(rel.replaceAll('\\','/').startsWith(p.path.replaceAll('\\','/')+'/'))rel=rel.slice(p.path.length+1);await api('file?projectId='+p.id+'&path='+encodeURIComponent(rel));selectedFile=rel;setView('preview');return;}
  if(name==='reveal'){const p=needProject();await window.piDesktop?.reveal(selectedFile?choosePath(p.path,selectedFile):p.path);return;}
  if(name==='pet'){await showRuntime();return;}
 }
 perform=async e=>{const b=e.target.closest('button,a');if(b?.dataset.feature)return action(b.dataset.feature,b.dataset.id||'',b);if(b?.dataset.action==='updates'){await settingsPage('updates');return window.piDesktop?.updates?.check();}if(b?.dataset.action==='more'&&task())return more(b);return oldPerform(e);};
 document.addEventListener('submit',e=>{
  if(e.target.id==='composer'){e.preventDefault();e.stopImmediatePropagation();sendCurrent().catch(showError);return;}
  const f=e.target;if(!f.dataset.featureForm)return;e.preventDefault();e.stopImmediatePropagation();
  const submit=f.querySelector('[type=submit]');if(submit.disabled)return;submit.disabled=true;
  (async()=>{
   const kind=f.dataset.featureForm;
   if(kind==='agent'){const raw={instructions:val(f,'instructions'),thinking:val(f,'thinking'),memory:val(f,'memory'),steeringMode:val(f,'steeringMode'),followUpMode:val(f,'followUpMode'),interruptMode:val(f,'interruptMode'),browserCdpUrl:val(f,'browserCdpUrl')};for(const input of f.querySelectorAll('[type=checkbox]'))raw[input.name]=input.checked;await api('settings/agent',raw);toast('Agent-Einstellungen gespeichert');return;}
   if(kind==='appearance'){prefs=await api('desktop-settings',{fontSize:Number(val(f,'fontSize')),reducedMotion:checked(f,'reducedMotion'),pet:checked(f,'pet'),shortcuts:Object.fromEntries(['new','open','search','inspector'].map(k=>[k,val(f,k)]))});applyAppearance();toast('Darstellung und Tastenkürzel gespeichert');return;}
   if(kind==='mcp'){const config={type:val(f,'type'),enabled:checked(f,'enabled'),command:val(f,'command'),args:jsonField(f,'args')||[],cwd:val(f,'cwd'),url:val(f,'url')};for(const key of ['env','headers']){const value=jsonField(f,key);if(value!==undefined)config[key]=value;}await api('capabilities/mcp-save',{name:val(f,'name'),edit:!!f.dataset.id,config});return settingsPage('mcp');}
   if(kind==='plugin-install'||kind==='marketplace'){if(!await yes(kind==='plugin-install'?'Dieses Plugin installieren? Erweiterungen können lokalen Code ausführen.':'Diese Marketplace-Quelle hinzufügen?'))return;await api('capabilities/'+(kind==='plugin-install'?'plugin-install':'marketplace'),kind==='plugin-install'?{target:val(f,'target')}:{source:val(f,'source')});return settingsPage('plugins');}
   if(kind==='rules'){if(!val(f,'text').trim()&&!await yes('Leere Regeldatei entfernen?'))return;await api('rules',{projectId:needProject().id,name:val(f,'name'),text:val(f,'text')});toast('Projektregeln gespeichert');return;}
   if(kind==='worktree'){await api('worktrees',{projectId:needProject().id,path:val(f,'path'),branch:val(f,'branch'),commit:val(f,'commit'),detach:checked(f,'detach')});return settingsPage('worktrees');}
   if(kind==='thinking'){await taskAPI('thinking',{level:val(f,'level')});session.thinkingLevel=val(f,'level');$('#connect-dialog').close();sync();return;}
   if(kind==='compact'){await taskAPI('compact',{customInstructions:val(f,'instructions')});await refreshSession();$('#connect-dialog').close();toast('Kontext komprimiert');return;}
   if(kind==='bash'){if(!await yes('Diesen Shell-Befehl mit deinen Benutzerrechten ausführen?\n\n'+val(f,'command').slice(0,1600)))return;const r=await taskAPI('bash',{command:val(f,'command')});contentDialog('Shell-Ergebnis',`<pre>${esc(typeof r==='string'?r:JSON.stringify(r,null,2))}</pre>`);return;}
   if(kind==='todos'){await taskAPI('todos',{phases:jsonField(f,'phases')});return showRuntime();}
   if(kind==='catalog'){const format=val(f,'format');const r=await api('local-models/catalog?q='+encodeURIComponent(val(f,'query'))+'&format='+format);$('#catalog-results').innerHTML=r.models.map(m=>row(m.id,`${m.fit} · ${m.license}`,button('catalog-detail','Dateien ansehen',m.id,`data-format="${esc(format)}"`))).join('')||note('Keine Modelle gefunden.');return;}
   if(kind==='download'){await api('local-models/download',{repo:downloadInfo.repo,revision:downloadInfo.revision,format:val(f,'format'),filename:val(f,'filename'),destination:val(f,'destination')});return showLocal();}
  })().catch(showError).finally(()=>{submit.disabled=false;});
 },true);
 document.addEventListener('change',e=>{if(e.target.dataset.contextModel)api('local-models/context',{id:e.target.dataset.contextModel,contextSize:Number(e.target.value)}).catch(showError).finally(()=>showLocal().catch(showError));});
 document.addEventListener('change',e=>{if(e.target.name==='name'&&e.target.closest('[data-feature-form=rules]')){const file=ruleList.find(f=>f.name===e.target.value);$('#f-text').value=file?.text||'';}});
 document.addEventListener('input',e=>{if(e.target.id==='f-commandFilter'){const q=e.target.value.toLowerCase();$('#command-list').querySelectorAll('.connection-row').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(q));}});
 document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('a[data-feature]')){e.preventDefault();perform(e).catch(showError);}});
 $('#connect-dialog').addEventListener('close',()=>{if(!$('#connect-dialog').open){clearInterval(localPoll);$('#connect-dialog').classList.remove('feature-dialog');}});
 $('#prompt').before(Object.assign(document.createElement('div'),{id:'image-attachments',className:'image-attachments'}));
 const addControl=(id,label,feature,glyph)=>`<button type="button" id="${id}" class="icon" data-feature="${feature}" aria-label="${label}" title="${label}">${icon(glyph)}</button>`;
 $('#composer .composer-controls').insertAdjacentHTML('afterbegin',addControl('clipboard-image','Bild aus Zwischenablage','image-clipboard','paperclip')+addControl('context-native','Kontextdatei auswählen','context-file','folder'));
 $('#model-label').closest('button').insertAdjacentHTML('beforebegin',`<button type="button" class="model" data-feature="thinking" aria-label="Denkaufwand"><span id="thinking-value">Aufwand</span></button>`);
 $('#stop-agent').insertAdjacentHTML('beforebegin',addControl('steer-send','Jetzt eingreifen (Alt+Enter)','steer-send','arrow')+addControl('interrupt-send','Abbrechen und neue Nachricht senden','interrupt-send','refresh'));
 $('.topbar .tools').insertAdjacentHTML('afterbegin',addControl('runtime-open','Todos und Subagenten','runtime','branch'));
 $('.inspector-toolbar').insertAdjacentHTML('beforeend',addControl('reveal-file','Im Explorer zeigen','reveal','folder'));
 document.body.insertAdjacentHTML('beforeend',`<button id="pi-pet" class="pi-pet" data-feature="pet" aria-label="Pi-Begleiter: Agentenstatus öffnen" hidden><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 28V10l15 10h10l15-10v18q7 28-20 28T12 28"/><path d="M22 34h1m18 0h1M28 43q4 5 8 0M6 37l14 3m24 0 14-3"/></svg></button>`);
 setInterval(()=>{const el=$('.live-status');if(el&&session.busy&&elapsedStart)el.lastChild.textContent=` ${session.pending?.length?'Wartet auf Genehmigung':'OMP arbeitet'} · ${Math.floor((Date.now()-elapsedStart)/1000)} s`;},1000);
 api('desktop-settings').then(s=>{prefs=s;applyAppearance();sync();}).catch(showError);
 function onUpdateStatus(s){
  if(s.phase==='downloading'&&downloadHidden)return;
  if(s.phase!=='downloading')downloadHidden=false;
  showUpdate(s);
  if($('#connect-dialog').open&&$('.settings-nav [data-id="updates"][aria-current="page"]')&&['upToDate','error','idle'].includes(s.phase))settingsPage('updates').catch(report);
 }
 window.piDesktop?.updates?.onStatus(onUpdateStatus);
 document.addEventListener('change',e=>{if(e.target.matches?.('[data-update-auto]'))window.piDesktop.updates.setAuto(e.target.checked).catch(report);});
 window.piFeatures={settingsPage,showRuntime,sessionTools,sendCurrent,action,safeMarkdown,approvalTool,addImage,showUpdate,onUpdateStatus,getImages:()=>images};
})();
