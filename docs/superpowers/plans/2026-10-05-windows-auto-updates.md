# Windows: Automatische Updates – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pi Desk für Windows wird als NSIS-Setup ausgeliefert, prüft selbst auf Updates, zeigt den Changelog und installiert nach Bestätigung.

**Architecture:** `electron-updater` (Generic-Provider) liest `updates/windows/latest.yml` über `raw.githubusercontent.com`. Ein testbares Steuermodul `desktop/updates.cjs` kapselt Ablauf und Zustand. `main.cjs` liefert Busy-Prüfung, Installation und IPC, die Oberfläche in `public/features.js` zeigt Dialog und Einstellungsbereich. GitHub Actions baut das Setup auf `windows-latest` als Entwurfs-Release. Ein lokales Skript schreibt den Feed, ein zweites rollt aus.

**Tech Stack:** Electron 44.4.5, electron-builder 26.15.3 (NSIS), electron-updater 6.8.9, `yaml` 2.8.2, `marked` + `DOMPurify`, Node `node:test`, GitHub Actions.

Spec: [2026-10-05-auto-updates-design.md](../specs/2026-10-05-auto-updates-design.md)

## Global Constraints

- Arbeitsverzeichnis für alle Befehle: `apps/windows` (außer wo `repo/` genannt ist).
- Deutsch in UI und Doku, echte Umlaute (ä, ö, ü, ß). Codekommentare englisch und knapp wie im Bestand.
- Quiet Studio Dark beibehalten: vorhandene Klassen (`connect-dialog`, `dialog-head`, `primary`, `secondary`, `form-actions`, `menu-note`, `error-line`) und CSS-Variablen (`--bg`, `--fg`, `--muted`, `--line`, `--green`) nutzen.
- Bestehende Genehmigungs- und Beenden-Abläufe nicht umgehen: Installation läuft durch dieselbe Busy-Prüfung wie `requestClose()`.
- Code-Stil wie `desktop/main.cjs` und `public/features.js`: kompakt, einzeilige Handler, kein neuer Formatter.
- Feed-URL: `https://raw.githubusercontent.com/LiLoLama/pi-desk/main/updates/windows/`
- Release-Asset-URL: `https://github.com/LiLoLama/pi-desk/releases/download/windows-vX.Y.Z/<Dateiname>`
- Prüfintervall: erste Prüfung 10 s nach Start, danach alle 6 h. `autoDownload=false`, `allowDowngrade=false`.
- Erste Version mit Updater: **0.4.0**.
- Keine gemeinsamen Module mit `apps/macos`. Doppelter Code pro Plattform ist gewollt (AGENTS.md).
- **Commits, Pushes und Releases nur mit ausdrücklicher Freigabe von Liam.** Die Commit-Schritte unten werden ausgeführt, sobald Liam Commits für diese Umsetzung freigegeben hat. Sonst bleiben die Änderungen ungestaged und der Schritt wird übersprungen. Commit-Nachrichten enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- macOS-Tests beweisen keinen Windows-Lauf. Ungeprüftes in `VERIFICATION.md` als offen führen.

## Dateiübersicht

| Datei | Aufgabe |
|---|---|
| `desktop/changelog.cjs` (neu) | Changelog lesen, Versionen vergleichen, Abschnitte filtern und rendern. Wird vom Updater und von den Release-Skripten genutzt. |
| `desktop/updates.cjs` (neu) | Update-Ablauf und Zustand (Prüfen, Überspringen, Später, Download, Installation), Speicherung in `updates.json` |
| `desktop/main.cjs` | Busy-Prüfung herausziehen, Installation, IPC-Handler, Menüpunkt, Logger |
| `desktop/preload.cjs` | `piDesktop.updates`-API |
| `public/features.js`, `public/features.css` | Einstellungsbereich „Updates“, Update-Dialog |
| `package.json`, `package-lock.json` | `electron-updater`, NSIS statt ZIP, Release-Skripte, Testliste |
| `CHANGELOG.md` (neu) | Nutzer-Changelog |
| `scripts/release-notes.mjs` (neu) | Release-Text aus Changelog |
| `scripts/release-feed.mjs` (neu) | `latest.yml` aus Entwurfs-Release → `repo/updates/windows/latest.yml` |
| `scripts/release-publish.mjs` (neu) | Release veröffentlichen, Feed committen und pushen (mit Rückfrage) |
| `repo/.github/workflows/windows-release.yml` (neu) | Windows-Build als Entwurfs-Release |
| `test/changelog.test.mjs`, `test/updates.test.mjs`, `test/release.test.mjs` (neu) | Unit-Tests |
| `test/desktop-smoke.cjs` | Smoke um Updates-API, Einstellungsseite und Dialog erweitern |
| `README.md`, `build/START.txt`, `VERIFICATION.md`, `WINDOWS-TESTPLAN.md`, `repo/README.md` | Doku |

---

### Task 1: Changelog-Modul und CHANGELOG.md

**Files:**
- Create: `desktop/changelog.cjs`
- Create: `CHANGELOG.md`
- Test: `test/changelog.test.mjs`
- Modify: `package.json` (Testliste)

**Interfaces:**
- Produces (CommonJS, `require('./changelog.cjs')`):
  - `parseChangelog(text: string) → Array<{version: string, date: string, body: string}>`. Reihenfolge wie in der Datei.
  - `compareVersions(a: string, b: string) → -1 | 0 | 1` (numerisch, `X.Y.Z`)
  - `sectionsNewerThan(entries, installed: string) → entries` (nur `> installed`, neueste zuerst)
  - `renderNotes(entries) → string` (`## X.Y.Z – Datum\n\nText`, Abschnitte durch Leerzeile getrennt)
  - `section(text: string, version: string) → entry` (wirft `Error('CHANGELOG.md enthält keinen Abschnitt für X.Y.Z.')`, wenn Abschnitt fehlt oder leer ist)

- [ ] **Step 1: Failing test schreiben**

`test/changelog.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {parseChangelog,compareVersions,sectionsNewerThan,renderNotes,section}=createRequire(import.meta.url)('../desktop/changelog.cjs');
const text=`# Pi Desk für Windows – Änderungen

## 0.5.0 – 20.10.2026

- Neu B

## 0.4.1 – 12.10.2026

- Neu A
- Zweiter Punkt

## 0.4.0

- Alt
`;
test('parses versions, optional dates and bodies',()=>{
 assert.deepEqual(parseChangelog(text),[{version:'0.5.0',date:'20.10.2026',body:'- Neu B'},{version:'0.4.1',date:'12.10.2026',body:'- Neu A\n- Zweiter Punkt'},{version:'0.4.0',date:'',body:'- Alt'}]);
 assert.deepEqual(parseChangelog(''),[]);
 assert.deepEqual(parseChangelog(undefined),[]);
});
test('compares numerically, not lexically',()=>{
 assert.equal(compareVersions('0.10.0','0.9.9'),1);
 assert.equal(compareVersions('0.4.0','0.4.0'),0);
 assert.equal(compareVersions('0.4.0','1.0.0'),-1);
});
test('keeps only sections newer than the installed version, newest first',()=>{
 const entries=parseChangelog(text).reverse();
 assert.deepEqual(sectionsNewerThan(entries,'0.4.0').map(e=>e.version),['0.5.0','0.4.1']);
 assert.deepEqual(sectionsNewerThan(entries,'0.5.0'),[]);
});
test('renders sections with headings',()=>{
 assert.equal(renderNotes(parseChangelog(text).slice(1)),'## 0.4.1 – 12.10.2026\n\n- Neu A\n- Zweiter Punkt\n\n## 0.4.0\n\n- Alt');
});
test('requires a non-empty section for a release',()=>{
 assert.equal(section(text,'0.4.1').body,'- Neu A\n- Zweiter Punkt');
 assert.throws(()=>section(text,'0.6.0'),/keinen Abschnitt für 0\.6\.0/);
 assert.throws(()=>section('## 0.6.0\n\n','0.6.0'),/keinen Abschnitt/);
});
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Run: `node --test test/changelog.test.mjs`
Expected: FAIL mit `Cannot find module '../desktop/changelog.cjs'`

- [ ] **Step 3: Implementierung**

`desktop/changelog.cjs`:

```js
// User-facing release notes: CHANGELOG.md sections "## X.Y.Z – DD.MM.YYYY".
const heading=/^## (\d+\.\d+\.\d+)(?:\s+[–-]\s+(.+?))?\s*$/;
function parseChangelog(text){
 const entries=[];let current=null;
 for(const line of String(text??'').split(/\r?\n/)){const match=line.match(heading);if(match){current={version:match[1],date:match[2]||'',lines:[]};entries.push(current);}else if(current)current.lines.push(line);}
 return entries.map(({lines,...entry})=>({...entry,body:lines.join('\n').trim()}));
}
function compareVersions(a,b){const left=String(a).split('.').map(Number),right=String(b).split('.').map(Number);for(let i=0;i<3;i++){const l=left[i]||0,r=right[i]||0;if(l!==r)return l>r?1:-1;}return 0;}
const sectionsNewerThan=(entries,installed)=>entries.filter(e=>compareVersions(e.version,installed)>0).sort((a,b)=>compareVersions(b.version,a.version));
const renderNotes=entries=>entries.map(e=>`## ${e.version}${e.date?` – ${e.date}`:''}\n\n${e.body}`).join('\n\n');
function section(text,version){const entry=parseChangelog(text).find(e=>e.version===version);if(!entry?.body)throw Error(`CHANGELOG.md enthält keinen Abschnitt für ${version}.`);return entry;}
module.exports={parseChangelog,compareVersions,sectionsNewerThan,renderNotes,section};
```

`CHANGELOG.md` (Datum der 0.4.0 wird beim Release in Task 8 auf den echten Tag gesetzt):

```markdown
# Pi Desk für Windows – Änderungen

## 0.4.0 – 05.10.2026

- Pi Desk sucht jetzt selbst nach Updates und zeigt vor dem Aktualisieren, was neu ist.
- Neue Einstellungsseite „Updates“: automatische Suche ein- oder ausschalten und jederzeit manuell prüfen.
- Pi Desk wird jetzt mit einem Setup installiert statt als ZIP. Chats, Anmeldungen und Einstellungen bleiben erhalten.
- Wichtig: Diese Version einmalig von Hand installieren. Danach kommen Updates automatisch.

## 0.3.0 – 02.10.2026

- Oh My Pi 18.4.10 integriert.
- Warteschlange und Agentenaktivität mit OMP synchronisiert.

## 0.2.0 – 29.09.2026

- Erste öffentliche Vorabversion für Windows x64.
```

In `package.json` an das Ende von `scripts.test` anhängen: ` test/changelog.test.mjs`.

- [ ] **Step 4: Tests laufen lassen**

Run: `node --test test/changelog.test.mjs && npm test`
Expected: alle PASS

- [ ] **Step 5: Commit**

```bash
git add desktop/changelog.cjs CHANGELOG.md test/changelog.test.mjs package.json
git commit -m "Windows: Changelog-Modul für Updates"
```

---

### Task 2: Update-Steuermodul `desktop/updates.cjs`

**Files:**
- Create: `desktop/updates.cjs`
- Test: `test/updates.test.mjs`
- Modify: `package.json` (Testliste)

**Interfaces:**
- Consumes: `parseChangelog`, `sectionsNewerThan`, `renderNotes` aus `desktop/changelog.cjs` (Task 1).
- Produces:
  - `createUpdates({updater, store, current, feedURL, send, install, timers?, now?})` → `{start(), check(manual: boolean) → Promise<Status>, download() → Promise<Status>, skip() → Status, later() → Status, setAuto(value: boolean) → Status, installNow() → Promise<Status>, status() → Status}`
    - `updater`: Objekt mit der API von `electron-updater`s `autoUpdater` (`on`, `setFeedURL`, `checkForUpdates`, `downloadUpdate`, Properties `autoDownload`, `autoInstallOnAppQuit`, `allowDowngrade`)
    - `store`: `{read() → object, write(object)}`
    - `send(status)`: meldet jede Zustandsänderung an die Oberfläche
    - `install({confirmBusy: boolean}) → Promise<boolean>`: von `main.cjs` geliefert (Task 3)
  - `Status = {phase: 'idle'|'checking'|'available'|'downloading'|'ready'|'upToDate'|'error', current, version, notes, percent, error, auto, lastCheck}`
  - `fileStore(file: string) → store`
  - Konstanten `FIRST_CHECK = 10000`, `INTERVAL = 21600000`

- [ ] **Step 1: Failing test schreiben**

`test/updates.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const {createUpdates,fileStore,FIRST_CHECK,INTERVAL}=createRequire(import.meta.url)('../desktop/updates.cjs');
const notes='## 0.5.0 – 20.10.2026\n\n- Neu B\n\n## 0.4.1 – 12.10.2026\n\n- Neu A\n\n## 0.4.0 – 05.10.2026\n\n- Alt';
function fakeUpdater(){const u=new EventEmitter();u.calls=[];u.setFeedURL=o=>u.calls.push(['feed',o]);u.checkForUpdates=async()=>{u.calls.push(['check']);await u.onCheck?.();};u.downloadUpdate=async()=>{u.calls.push(['download']);await u.onDownload?.();};return u;}
const memory=(data={})=>({data,read(){return {...this.data};},write(d){this.data={...d};}});
function fakeTimers(){const t={timeouts:[],intervals:[]};t.setTimeout=(f,ms)=>t.timeouts.push([f,ms]);t.setInterval=(f,ms)=>t.intervals.push([f,ms]);return t;}
function setup(store=memory()){
 const updater=fakeUpdater(),sent=[],timers=fakeTimers(),installs=[];
 const updates=createUpdates({updater,store,current:'0.4.0',feedURL:'https://example.test/feed/',send:s=>sent.push(s),install:async options=>{installs.push(options);return true;},timers,now:()=>new Date('2026-10-05T10:00:00Z')});
 return {updates,updater,sent,timers,store,installs};
}
const offer=updater=>{updater.onCheck=()=>updater.emit('update-available',{version:'0.5.0',releaseNotes:notes});};
test('configures a generic feed without automatic download and schedules checks',()=>{
 const {updates,updater,timers}=setup();
 assert.deepEqual(updater.calls[0],['feed',{provider:'generic',url:'https://example.test/feed/'}]);
 assert.equal(updater.autoDownload,false);assert.equal(updater.autoInstallOnAppQuit,true);assert.equal(updater.allowDowngrade,false);
 updates.start();
 assert.deepEqual(timers.timeouts.map(t=>t[1]),[FIRST_CHECK]);assert.deepEqual(timers.intervals.map(t=>t[1]),[INTERVAL]);
 assert.equal(FIRST_CHECK,10000);assert.equal(INTERVAL,6*60*60*1000);
});
test('an offered update shows only newer notes, newest first',async()=>{
 const {updates,updater,store}=setup();offer(updater);
 const status=await updates.check(false);
 assert.equal(status.phase,'available');assert.equal(status.version,'0.5.0');assert.equal(status.current,'0.4.0');
 assert.equal(status.notes,'## 0.5.0 – 20.10.2026\n\n- Neu B\n\n## 0.4.1 – 12.10.2026\n\n- Neu A');
 assert.equal(store.data.lastCheck,'2026-10-05T10:00:00.000Z');
});
test('background checks stay silent; manual checks report the result',async()=>{
 const {updates,updater}=setup();
 updater.onCheck=()=>updater.emit('update-not-available',{version:'0.4.0'});
 assert.equal((await updates.check(false)).phase,'idle');
 assert.equal((await updates.check(true)).phase,'upToDate');
 updater.onCheck=()=>{throw Error('offline');};
 assert.equal((await updates.check(false)).phase,'idle');
 const failed=await updates.check(true);
 assert.equal(failed.phase,'error');assert.match(failed.error,/nicht erreichbar/);
});
test('skipping persists and hides only background offers of that version',async()=>{
 const store=memory();let {updates,updater}=setup(store);offer(updater);
 await updates.check(false);assert.equal(updates.skip().phase,'idle');assert.equal(store.data.skipped,'0.5.0');
 ({updates,updater}=setup(store));offer(updater);
 assert.equal((await updates.check(false)).phase,'idle');
 assert.equal((await updates.check(true)).phase,'available');
});
test('later hides background offers until the next start',async()=>{
 const store=memory();let {updates,updater}=setup(store);offer(updater);
 await updates.check(false);assert.equal(updates.later().phase,'idle');
 assert.equal((await updates.check(false)).phase,'idle');
 ({updates,updater}=setup(store));offer(updater);
 assert.equal((await updates.check(false)).phase,'available');
});
test('a requested download reports progress and installs without interrupting work',async()=>{
 const {updates,updater,sent,installs}=setup();offer(updater);await updates.check(false);
 updater.onDownload=()=>{updater.emit('download-progress',{percent:41.6});updater.emit('update-downloaded',{version:'0.5.0'});};
 const status=await updates.download();
 assert.ok(sent.some(s=>s.phase==='downloading'&&s.percent===42));
 assert.equal(status.phase,'ready');
 await new Promise(setImmediate);
 assert.deepEqual(installs,[{confirmBusy:false}]);
 await updates.installNow();
 assert.deepEqual(installs,[{confirmBusy:false},{confirmBusy:true}]);
});
test('install is only possible once an update is ready',async()=>{
 const {updates,installs}=setup();
 assert.equal((await updates.installNow()).phase,'idle');assert.deepEqual(installs,[]);
});
test('a failed download keeps the current version and explains it',async()=>{
 const {updates,updater}=setup();offer(updater);await updates.check(false);
 updater.onDownload=()=>{updater.emit('error',Error('sha512 checksum mismatch'));throw Error('sha512 checksum mismatch');};
 const status=await updates.download();
 assert.equal(status.phase,'error');
 assert.equal(status.error,'Das Update konnte nicht geladen oder bestätigt werden. Es wurde nichts verändert.');
});
test('turning automatic checks off silences scheduled checks and persists',async()=>{
 const store=memory();const {updates,updater,timers}=setup(store);
 updates.setAuto(false);updates.start();
 timers.timeouts[0][0]();timers.intervals[0][0]();await new Promise(setImmediate);
 assert.equal(updater.calls.filter(c=>c[0]==='check').length,0);
 assert.equal(store.data.auto,false);
});
test('the file store survives missing and broken files',()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'pi-updates-'));const file=path.join(dir,'sub','updates.json');
 const store=fileStore(file);assert.deepEqual(store.read(),{});
 store.write({auto:false,skipped:'0.5.0',lastCheck:''});
 assert.deepEqual(JSON.parse(readFileSync(file,'utf8')),{auto:false,skipped:'0.5.0',lastCheck:''});
});
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Run: `node --test test/updates.test.mjs`
Expected: FAIL mit `Cannot find module '../desktop/updates.cjs'`

- [ ] **Step 3: Implementierung**

`desktop/updates.cjs`:

```js
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
```

In `package.json` an `scripts.test` anhängen: ` test/updates.test.mjs`.

- [ ] **Step 4: Tests laufen lassen**

Run: `node --test test/updates.test.mjs && npm test`
Expected: alle PASS

- [ ] **Step 5: Commit**

```bash
git add desktop/updates.cjs test/updates.test.mjs package.json
git commit -m "Windows: Update-Ablauf als testbares Modul"
```

---

### Task 3: electron-updater in Hauptprozess und Preload einbinden

**Files:**
- Modify: `package.json`, `package-lock.json` (Abhängigkeit)
- Modify: `desktop/main.cjs`
- Modify: `desktop/preload.cjs`
- Test: `test/desktop-smoke.cjs`

**Interfaces:**
- Consumes: `createUpdates`, `fileStore` (Task 2)
- Produces:
  - Renderer-API `window.piDesktop.updates = {state(), check(), download(), install(), skip(), later(), setAuto(boolean), onStatus(callback) → unsubscribe}`. Alle Methoden außer `onStatus` liefern `Promise<Status>`.
  - IPC-Kanäle: `pi:update-state`, `pi:update-check`, `pi:update-download`, `pi:update-install`, `pi:update-skip`, `pi:update-later`, `pi:update-auto`, Ereignis `pi:update-status`
  - Menüaktion `updates` über `pi:action`

- [ ] **Step 1: Abhängigkeit installieren**

Run: `npm install electron-updater@6.8.9 --save-exact`
Expected: `package.json` → `"dependencies"` enthält `"electron-updater": "6.8.9"`, Lockfile aktualisiert.

- [ ] **Step 2: Smoke-Test erweitern (failing)**

In `test/desktop-smoke.cjs` direkt nach `assert.equal(await run('typeof window.piDesktop.chooseProject'),'function');` einfügen:

```js
   assert.equal(await run('typeof window.piDesktop.updates.check'),'function');
   const update=await run('window.piDesktop.updates.state()');
   assert.equal(update.phase,'idle');assert.equal(update.current,require('../package.json').version);assert.equal('feedURL' in update,false);
```

Run: `npm run test:desktop`
Expected: FAIL (`Cannot read properties of undefined (reading 'check')`)

- [ ] **Step 3: `main.cjs` anpassen**

Oben nach `const {isLocal,externalURL}=require('./security.cjs');`:

```js
const {autoUpdater}=require('electron-updater');
const {createUpdates,fileStore}=require('./updates.cjs');
const UPDATE_FEED='https://raw.githubusercontent.com/LiLoLama/pi-desk/main/updates/windows/';
```

`let window,helper,origin,token,quitting=false,closing=false;` ersetzen durch:

```js
let window,helper,origin,token,updates,quitting=false,closing=false;
```

Die komplette Funktion `requestClose` ersetzen durch:

```js
async function engineBusy(){
 try{const state=await fetch(origin+'/api/state',{headers:{'X-Pi-Desk-Native':token},signal:AbortSignal.timeout(2000)}).then(r=>r.json());return Boolean(state.authBusy||state.tasks?.some(t=>t.busy));}
 catch{return false;}
}
async function confirmInterrupt(){
 const {response}=await dialog.showMessageBox(window,{type:'question',title:'Laufende Arbeit beenden?',message:'Der Agent arbeitet noch. Beim Beenden wird der Vorgang abgebrochen.',buttons:['Weiterarbeiten','Beenden'],defaultId:0,cancelId:0});
 return response===1;
}
async function requestClose(){
 if(closing)return;closing=true;
 try{if(await engineBusy()&&!await confirmInterrupt())return;quitting=true;await shutdown();app.quit();}finally{closing=false;}
}
// Same rule as quitting: never interrupt running work without asking; automatic installs simply wait.
async function installUpdate({confirmBusy}){
 if(closing)return false;closing=true;
 try{
  if(await engineBusy()&&(!confirmBusy||!await confirmInterrupt()))return false;
  quitting=true;await shutdown();autoUpdater.quitAndInstall(true,true);return true;
 }finally{closing=false;}
}
function updateLogger(){
 const file=path.join(profile,'desktop','logs','updates.log');
 const write=level=>message=>{fs.mkdir(path.dirname(file),{recursive:true}).then(()=>fs.appendFile(file,`${new Date().toISOString()} ${level} ${message}\n`)).catch(()=>{});};
 return {info:write('info'),warn:write('warn'),error:write('error'),debug:()=>{}};
}
```

In `boot()` direkt nach der Zeile `ipcMain.handle('pi:save-artifact',…);` einfügen:

```js
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
```

Im Menü `Datei` nach `{label:'Einstellungen',…},` einfügen:

```js
{label:'Nach Updates suchen …',click:action('updates')},
```

`await window.loadURL(origin);window.show();` ersetzen durch:

```js
 await window.loadURL(origin);window.show();
 if(app.isPackaged||devFeed)updates.start();
```

- [ ] **Step 4: `preload.cjs` erweitern**

Vor der Zeile `onAction:callback=>…` einfügen:

```js
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
```

- [ ] **Step 5: Tests laufen lassen**

Run: `npm test && npm run test:desktop`
Expected: Unit-Tests PASS; Desktop-Smoke endet mit `PASS: actual Electron window, …`

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json desktop/main.cjs desktop/preload.cjs test/desktop-smoke.cjs
git commit -m "Windows: electron-updater mit Busy-Sperre anbinden"
```

---

### Task 4: Update-Dialog und Einstellungsbereich „Updates“

**Files:**
- Modify: `public/features.js`
- Modify: `public/features.css`
- Test: `test/desktop-smoke.cjs`

**Interfaces:**
- Consumes: `window.piDesktop.updates` (Task 3), vorhandene Helfer `button`, `note`, `listing`, `row`, `settingsShell`, `safeMarkdown`, `esc`, `icon`, `$`, `report`.
- Produces: `window.piFeatures.showUpdate(status)`. Tab-ID `updates`, Feature-Aktionen `update-check`, `update-download`, `update-install`, `update-skip`, `update-later`, `update-close`.

- [ ] **Step 1: Smoke-Test erweitern (failing)**

In `test/desktop-smoke.cjs` vor `const output=path.resolve(__dirname,'../verification');` einfügen:

```js
   await run("piFeatures.settingsPage('updates')");
   assert.equal(await run(`$('#connect-dialog').textContent.includes('Automatisch nach Updates suchen')`),true);
   await run(`$('#connect-dialog').close()`);
   await run(`piFeatures.showUpdate({phase:'available',current:'0.4.0',version:'0.5.0',notes:'## 0.5.0 – 20.10.2026\\n\\n- Neu <img src=x onerror=alert(1)>',percent:0,error:'',auto:true,lastCheck:''})`);
   assert.equal(await run(`$('#update-dialog').open&&$('#update-dialog').textContent.includes('Pi Desk 0.5.0 ist verfügbar')`),true);
   assert.equal(await run(`$('#update-dialog').innerHTML.includes('<img')`),false);
   mkdirSync(path.resolve(__dirname,'../verification'),{recursive:true});writeFileSync(path.join(path.resolve(__dirname,'../verification'),'update.png'),(await web.capturePage()).toPNG());
   await run(`piFeatures.showUpdate({phase:'idle'})`);
   assert.equal(await run(`$('#update-dialog').open`),false);
```

Run: `npm run test:desktop`
Expected: FAIL (`piFeatures.showUpdate is not a function` bzw. Seite ohne Text)

- [ ] **Step 2: Tab und Seite ergänzen**

In `public/features.js` die `tabs`-Konstante ändern. `['worktrees','Git & Worktrees'],` wird gefolgt von `['updates','Updates'],` vor `['archive','Archiv & Papierkorb']`:

```js
 const tabs=[['providers','Modelle & Anbieter'],['local','Lokale Modelle'],['agent','Agent'],['skills','Skills'],['mcp','MCP'],['plugins','Plugins & Hooks'],['appearance','Darstellung & Tastatur'],['rules','Projektregeln'],['worktrees','Git & Worktrees'],['updates','Updates'],['archive','Archiv & Papierkorb']];
```

In `settingsPage` vor `}else if(page==='local')return showLocal();` einfügen:

```js
  }else if(page==='updates'){
   const u=window.piDesktop?.updates;
   if(!u)return settingsShell(page,note('Updates sind nur in der Desktop-App verfügbar.'));
   const s=await u.state();
   settingsShell(page,listing('Updates',row('Installierte Version',s.current,'')+row('Letzte Prüfung',s.lastCheck?new Date(s.lastCheck).toLocaleString('de-DE'):'Noch nicht geprüft',''))+`<label class="check-row"><input type="checkbox" data-update-auto ${s.auto?'checked':''}>Automatisch nach Updates suchen</label>`+button('update-check','Jetzt nach Updates suchen')+(s.phase==='upToDate'?note(`Pi Desk ${s.current} ist aktuell.`):'')+(s.phase==='error'?`<p class="error-line">${esc(s.error)}</p>`:'')+note('Pi Desk sucht beim Start und danach alle 6 Stunden. Vor jeder Installation siehst du, was neu ist.'));
```

- [ ] **Step 3: Dialog und Aktionen ergänzen**

In `public/features.js` direkt vor `async function action(name,id,el){` einfügen:

```js
 const updateDialog=()=>{let d=$('#update-dialog');if(!d){d=document.createElement('dialog');d.id='update-dialog';d.className='connect-dialog update-dialog';d.setAttribute('aria-label','Pi Desk aktualisieren');document.body.append(d);}return d;};
 const closeUpdate=()=>{const d=$('#update-dialog');if(d?.open)d.close();};
 function showUpdate(s){
  const head=title=>`<div class="dialog-head"><h2>${esc(title)}</h2><button class="icon" data-feature="update-later" aria-label="Schließen">${icon('close')}</button></div>`;
  let html;
  if(s.phase==='available')html=head(`Pi Desk ${s.version} ist verfügbar`)+`<p class="menu-note">Du hast ${esc(s.current)}.</p><div class="update-notes">${safeMarkdown(s.notes)}</div><div class="form-actions">${button('update-skip','Diese Version überspringen')}<span class="update-spacer"></span>${button('update-later','Später')}<button type="button" class="primary" data-feature="update-download">Jetzt aktualisieren</button></div>`;
  else if(s.phase==='downloading')html=head('Update wird geladen')+`<progress max="100" value="${Number(s.percent)||0}"></progress><p class="menu-note">${Number(s.percent)||0} %</p>`;
  else if(s.phase==='ready')html=head(`Pi Desk ${s.version} ist bereit`)+`<p>Ein Vorgang läuft noch. Das Update wird beim nächsten Beenden installiert.</p><div class="form-actions">${button('update-close','Beim Beenden installieren')}<button type="button" class="primary" data-feature="update-install">Jetzt neu starten</button></div>`;
  else if(s.phase==='upToDate')html=head('Keine Updates')+`<p>Pi Desk ${esc(s.current)} ist aktuell.</p><div class="form-actions"><span class="update-spacer"></span><button type="button" class="primary" data-feature="update-close">OK</button></div>`;
  else if(s.phase==='error')html=head('Update nicht möglich')+`<p class="error-line">${esc(s.error)}</p><div class="form-actions">${button('update-close','Schließen')}<button type="button" class="primary" data-feature="update-check">Erneut versuchen</button></div>`;
  else return closeUpdate();
  const d=updateDialog();d.innerHTML=html;if(!d.open)d.showModal();
 }
```

In `action(name,id,el)` direkt nach `if(name==='settings-page')return settingsPage(id);` einfügen:

```js
  if(name==='update-check')return window.piDesktop.updates.check();
  if(name==='update-download')return window.piDesktop.updates.download();
  if(name==='update-install')return window.piDesktop.updates.install();
  if(name==='update-skip'){closeUpdate();return window.piDesktop.updates.skip();}
  if(name==='update-later'){closeUpdate();return window.piDesktop.updates.later();}
  if(name==='update-close')return closeUpdate();
```

Die `perform=async e=>{…}`-Zeile ersetzen durch:

```js
perform=async e=>{const b=e.target.closest('button,a');if(b?.dataset.feature)return action(b.dataset.feature,b.dataset.id||'',b);if(b?.dataset.action==='updates')return settingsPage('updates');if(b?.dataset.action==='more'&&task())return more(b);return oldPerform(e);};
```

Vor `window.piFeatures={…};` einfügen:

```js
 window.piDesktop?.updates?.onStatus(s=>{showUpdate(s);if($('.settings-nav [data-id="updates"][aria-current="page"]')&&['upToDate','error','idle'].includes(s.phase))settingsPage('updates').catch(report);});
 document.addEventListener('change',e=>{if(e.target.matches?.('[data-update-auto]'))window.piDesktop.updates.setAuto(e.target.checked).catch(report);});
```

`window.piFeatures={…}` um `showUpdate` ergänzen:

```js
 window.piFeatures={settingsPage,showRuntime,sessionTools,sendCurrent,action,safeMarkdown,approvalTool,addImage,showUpdate,getImages:()=>images};
```

- [ ] **Step 4: CSS ergänzen**

An `public/features.css` anhängen:

```css
.update-dialog{width:min(560px,calc(100vw - 32px))}.update-notes{max-height:320px;overflow:auto;padding:10px 14px;border:1px solid var(--line);border-radius:8px;margin:10px 0}.update-notes h2{font-size:15px;margin:12px 0 4px}.update-notes h2:first-child{margin-top:0}.update-dialog .form-actions{align-items:center}.update-spacer{flex:1}.update-dialog progress{width:100%;accent-color:var(--green)}
```

- [ ] **Step 5: Tests laufen lassen und Screenshot prüfen**

Run: `npm test && npm run test:desktop`
Expected: PASS. Danach `verification/update.png` öffnen (Read-Tool) und prüfen: dunkler Dialog im Quiet-Studio-Stil, Changelog lesbar, drei Knöpfe, keine Überlappung.

- [ ] **Step 6: Commit**

```bash
git add public/features.js public/features.css test/desktop-smoke.cjs
git commit -m "Windows: Update-Dialog und Einstellungsseite"
```

---

### Task 5: Auslieferung als NSIS-Setup

**Files:**
- Modify: `package.json`
- Modify: `build/START.txt`

**Interfaces:**
- Produces: `npm run build:win` erzeugt `dist/Pi-Desk-<version>-Windows-x64-Setup.exe` und `dist/latest.yml` (nur auf Windows ausführbar, siehe Task 7).

- [ ] **Step 1: Version und Build-Konfiguration**

In `package.json`:
- `"version": "0.3.0"` → `"version": "0.4.0"`
- `scripts`: `"build:win"` ersetzen durch `"build:win": "npm run runtime:win && electron-builder --win nsis --x64 --publish never"`, die Zeile `"build:installer"` entfernen. Ergänzen: `"release:feed": "node scripts/release-feed.mjs"`, `"release:publish": "node scripts/release-publish.mjs"`
- `build.win.target` ersetzen durch `[{"target": "nsis", "arch": ["x64"]}]`
- `build.win.artifactName` entfernen (NSIS nutzt `build.nsis.artifactName`)
- `build.nsis` um `"differentialPackage": false` ergänzen
- in `build` ergänzen: `"publish": [{"provider": "generic", "url": "https://raw.githubusercontent.com/LiLoLama/pi-desk/main/updates/windows/"}]`

Prüfen:

Run: `node -e "const b=require('./package.json').build;if(b.win.target[0].target!=='nsis'||b.nsis.differentialPackage!==false||!b.publish[0].url.endsWith('/updates/windows/'))process.exit(1);console.log('ok')"`
Expected: `ok`

- [ ] **Step 2: `build/START.txt` neu fassen**

```text
Pi Desk für Windows – Version 0.4.0 (x64)

1. Pi-Desk-0.4.0-Windows-x64-Setup.exe ausführen. Keine Administratorrechte nötig.
   Windows SmartScreen kann warnen, weil das Setup nicht signiert ist:
   „Weitere Informationen“ → „Trotzdem ausführen“.
2. Pi Desk über das Startmenü oder die Desktopverknüpfung öffnen.
3. Anbieter verbinden oder in den Einstellungen einen Modellserver hinzufügen.
4. Strg+O: Projektordner wählen. Modell wählen und Nachricht senden.

Updates: Pi Desk sucht selbst nach neuen Versionen und zeigt vor der
Installation, was neu ist. Einstellungen → Updates.

Node und Oh My Pi sind enthalten. Git ist für Git-Funktionen zusätzlich nötig.
Enter: senden/einreihen. Shift+Enter: Absatz. Alt+Enter: sofortige Steuerung.
Strg+K: Suche. Strg+,: Einstellungen.

WINDOWS-TESTPLAN.md enthält die vollständige Testliste.
README-WINDOWS.md erläutert Funktionen und verbleibende Unterschiede.
Daten: %LOCALAPPDATA%\Pi Desk\engine sowie %LOCALAPPDATA%\Pi Desk\desktop
Bisherige ZIP-Installation: Daten werden übernommen, den alten Ordner danach löschen.

Nicht signiert. Windows x64, kein MLX.
```

- [ ] **Step 3: Tests**

Run: `npm test`
Expected: PASS (kein Test kodiert die Version fest; geprüft am 05.10.2026)

- [ ] **Step 4: Commit**

```bash
git add package.json build/START.txt
git commit -m "Windows: Setup statt ZIP, Version 0.4.0"
```

---

### Task 6: Release-Skripte (Notizen, Feed, Ausrollen)

**Files:**
- Create: `scripts/release-notes.mjs`
- Create: `scripts/release-feed.mjs`
- Create: `scripts/release-publish.mjs`
- Test: `test/release.test.mjs`
- Modify: `package.json` (Testliste)

**Interfaces:**
- Consumes: `parseChangelog`, `section`, `renderNotes`, `compareVersions` (Task 1)
- Produces:
  - `releaseNotes(changelog: string, version: string) → string` (export aus `release-notes.mjs`; CLI gibt sie auf stdout aus)
  - `feedFromRelease(latestYml: string, {tag, version, changelog}) → string` (export aus `release-feed.mjs`)
  - CLI `npm run release:feed`, `npm run release:publish`

- [ ] **Step 1: Failing test schreiben**

`test/release.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import {feedFromRelease} from '../scripts/release-feed.mjs';
import {releaseNotes} from '../scripts/release-notes.mjs';
const changelog='# Änderungen\n\n## 0.5.0 – 20.10.2026\n\n- Zukunft\n\n## 0.4.0 – 12.10.2026\n\n- Updates\n\n## 0.3.0 – 02.10.2026\n\n- OMP 18.4.10\n';
const latest=`version: 0.4.0
files:
  - url: Pi-Desk-0.4.0-Windows-x64-Setup.exe
    sha512: abc==
    size: 123
path: Pi-Desk-0.4.0-Windows-x64-Setup.exe
sha512: abc==
releaseDate: '2026-10-12T10:00:00.000Z'
`;
test('feed points to the release asset and carries notes up to this version',()=>{
 const feed=YAML.parse(feedFromRelease(latest,{tag:'windows-v0.4.0',version:'0.4.0',changelog}));
 const url='https://github.com/LiLoLama/pi-desk/releases/download/windows-v0.4.0/Pi-Desk-0.4.0-Windows-x64-Setup.exe';
 assert.equal(feed.path,url);assert.equal(feed.files[0].url,url);assert.equal(feed.files[0].sha512,'abc==');assert.equal(feed.sha512,'abc==');
 assert.equal(feed.releaseNotes,'## 0.4.0 – 12.10.2026\n\n- Updates\n\n## 0.3.0 – 02.10.2026\n\n- OMP 18.4.10');
});
test('feed refuses a mismatched build or a missing changelog section',()=>{
 assert.throws(()=>feedFromRelease(latest,{tag:'windows-v0.4.1',version:'0.4.1',changelog}),/erwartet 0\.4\.1/);
 assert.throws(()=>feedFromRelease(latest.replaceAll('0.4.0','0.4.2'),{tag:'windows-v0.4.2',version:'0.4.2',changelog}),/keinen Abschnitt/);
});
test('feed keeps at most ten sections',()=>{
 const many=Array.from({length:12},(_,i)=>`## 0.${20-i}.0\n\n- Punkt ${i}`).join('\n\n');
 const yml=latest.replaceAll('0.4.0','0.20.0');
 const feed=YAML.parse(feedFromRelease(yml,{tag:'windows-v0.20.0',version:'0.20.0',changelog:many}));
 assert.equal((feed.releaseNotes.match(/^## /gm)||[]).length,10);
});
test('release notes contain the section and the installation hint',()=>{
 const notes=releaseNotes(changelog,'0.4.0');
 assert.match(notes,/^- Updates/);assert.match(notes,/SmartScreen/);assert.doesNotMatch(notes,/Zukunft/);
});
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Run: `node --test test/release.test.mjs`
Expected: FAIL (`Cannot find module '../scripts/release-feed.mjs'`)

- [ ] **Step 3: `scripts/release-notes.mjs`**

```js
// Release text for GitHub, built from the CHANGELOG.md section of the current version.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {section}=createRequire(import.meta.url)('../desktop/changelog.cjs');
export const releaseNotes=(changelog,version)=>`${section(changelog,version).body}

---
Windows x64. Setup ohne Administratorrechte. Nicht signiert: SmartScreen kann beim ersten Start warnen („Weitere Informationen“ → „Trotzdem ausführen“). Ab dieser Version aktualisiert sich Pi Desk selbst. SHA-256 in SHA256SUMS-windows.txt.`;
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 const {version}=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
 process.stdout.write(releaseNotes(await readFile(path.join(root,'CHANGELOG.md'),'utf8'),version)+'\n');
}
```

- [ ] **Step 4: `scripts/release-feed.mjs`**

```js
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
 const tmp=await mkdtemp(path.join(os.tmpdir(),'pi-desk-feed-'));
 try{
  const result=spawnSync('gh',['release','download',tag,'--repo',REPO,'--pattern','latest.yml','--dir',tmp],{stdio:'inherit'});
  if(result.status!==0)throw Error(`latest.yml aus ${tag} nicht ladbar. Ist der Windows-Workflow fertig?`);
  const feed=path.join(repo,'updates','windows','latest.yml');
  await mkdir(path.dirname(feed),{recursive:true});
  await writeFile(feed,feedFromRelease(await readFile(path.join(tmp,'latest.yml'),'utf8'),{tag,version,changelog:await readFile(path.join(root,'CHANGELOG.md'),'utf8')}));
  console.log(`Feed lokal geschrieben: updates/windows/latest.yml (${version}).\nEntwurf testen, dann: npm run release:publish`);
 }finally{await rm(tmp,{recursive:true,force:true});}
}
```

- [ ] **Step 5: `scripts/release-publish.mjs`**

```js
// Makes a prepared Windows release live: publish the draft, then commit and push the feed.
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline/promises';
import {fileURLToPath} from 'node:url';
import YAML from 'yaml';
const REPO='LiLoLama/pi-desk';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),repo=path.resolve(root,'../..');
const run=(cmd,args,capture=false)=>{const r=spawnSync(cmd,args,{cwd:repo,encoding:'utf8',stdio:capture?['ignore','pipe','inherit']:'inherit'});if(r.status!==0)throw Error(`${cmd} ${args[0]} fehlgeschlagen`);return (r.stdout||'').trim();};
const {version}=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')),tag=`windows-v${version}`;
const feed='updates/windows/latest.yml';
if(run('git',['rev-parse','--abbrev-ref','HEAD'],true)!=='main')throw Error('Ausrollen nur vom Branch main.');
if(!run('git',['status','--porcelain','--',feed],true))throw Error('Keine Feed-Änderung. Zuerst npm run release:feed.');
if(YAML.parse(await readFile(path.join(repo,feed),'utf8')).version!==version)throw Error(`Feed nennt nicht ${version}.`);
console.log(run('gh',['release','view',tag,'--repo',REPO,'--json','isDraft,assets','--jq','"Entwurf: "+(.isDraft|tostring)+" · Anhänge: "+([.assets[].name]|join(", "))'],true));
const rl=readline.createInterface({input:process.stdin,output:process.stdout});
const answer=(await rl.question(`Pi Desk ${version} jetzt an alle Windows-Nutzer ausrollen? (ja/nein) `)).trim().toLowerCase();rl.close();
if(answer!=='ja'){console.log('Abgebrochen. Nichts veröffentlicht.');process.exit(0);}
run('gh',['release','edit',tag,'--repo',REPO,'--draft=false']);
run('git',['add','--',feed]);run('git',['commit','-m',`Windows ${version} ausrollen`,'--',feed]);run('git',['push']);
console.log('Ausgerollt. Nutzer sehen das Update spätestens nach ihrer nächsten Prüfung (raw-Cache ca. 5 Minuten).');
```

In `package.json` an `scripts.test` anhängen: ` test/release.test.mjs`.

- [ ] **Step 6: Tests laufen lassen**

Run: `node --test test/release.test.mjs && npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add scripts/release-notes.mjs scripts/release-feed.mjs scripts/release-publish.mjs test/release.test.mjs package.json
git commit -m "Windows: Release-Skripte für Feed und Ausrollen"
```

---

### Task 7: GitHub-Actions-Workflow für den Windows-Build

**Files:**
- Create: `repo/.github/workflows/windows-release.yml` (also `/Users/liam/Developer/LIAM/pi-desk/.github/workflows/windows-release.yml`)

**Interfaces:**
- Consumes: `npm test`, `npm run build:win` (Task 5), `scripts/release-notes.mjs` (Task 6)
- Produces: Entwurfs-Release `windows-vX.Y.Z` mit `Pi-Desk-X.Y.Z-Windows-x64-Setup.exe`, `latest.yml`, `SHA256SUMS-windows.txt`

- [ ] **Step 1: Workflow anlegen**

```yaml
name: Windows-Release
on:
  workflow_dispatch:
permissions:
  contents: write
jobs:
  build:
    runs-on: windows-latest
    defaults:
      run:
        working-directory: apps/windows
        shell: pwsh
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: apps/windows/package-lock.json
      - run: npm ci
      - run: npm test
      - run: npm run build:win
      - name: Prüfsummen und Release-Text
        run: |
          $version = (Get-Content package.json -Raw | ConvertFrom-Json).version
          $setup = "Pi-Desk-$version-Windows-x64-Setup.exe"
          if (-not (Test-Path "dist/$setup") -or -not (Test-Path "dist/latest.yml")) { throw "Setup oder latest.yml fehlt" }
          $hash = (Get-FileHash "dist/$setup" -Algorithm SHA256).Hash.ToLower()
          "$hash  $setup" | Out-File -Encoding ascii dist/SHA256SUMS-windows.txt
          node scripts/release-notes.mjs | Out-File -Encoding utf8 dist/release-notes.md
      - name: Entwurfs-Release anlegen
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          $version = (Get-Content package.json -Raw | ConvertFrom-Json).version
          gh release create "windows-v$version" "dist/Pi-Desk-$version-Windows-x64-Setup.exe" dist/latest.yml dist/SHA256SUMS-windows.txt --draft --prerelease --target $env:GITHUB_SHA --title "Pi Desk für Windows $version (x64)" --notes-file dist/release-notes.md
```

- [ ] **Step 2: Syntax lokal prüfen**

Run: `node -e "const Y=require('yaml');const w=Y.parse(require('fs').readFileSync('../../.github/workflows/windows-release.yml','utf8'));if(!('workflow_dispatch' in w.on)||w.jobs.build['runs-on']!=='windows-latest')process.exit(1);console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit, Push und Testlauf (nur mit Liams Freigabe)**

Vorher in `CHANGELOG.md` das Datum `## 0.4.0 – 05.10.2026` auf den heutigen Tag setzen. Der Workflow liest den Release-Text aus dem gepushten Stand.

```bash
git add ../../.github/workflows/windows-release.yml CHANGELOG.md
git commit -m "Windows-Build als Entwurfs-Release über GitHub Actions"
git push
gh workflow run windows-release.yml --repo LiLoLama/pi-desk --ref main
gh run watch --repo LiLoLama/pi-desk
```

Expected: Lauf grün. `gh release view windows-v0.4.0 --repo LiLoLama/pi-desk` zeigt einen Entwurf mit drei Anhängen.

Schlägt `npm test` auf Windows fehl, ist das ein echter Befund (erstmals Tests auf Windows). Ursache beheben und in `VERIFICATION.md` festhalten, nicht überspringen. Ein fehlerhafter Entwurf wird erst nach Rückfrage bei Liam mit `gh release delete windows-v0.4.0 --repo LiLoLama/pi-desk` entfernt.

---

### Task 8: Doku und Übergangsrelease

**Files:**
- Modify: `README.md`, `VERIFICATION.md`, `WINDOWS-TESTPLAN.md`
- Modify: `repo/README.md`

- [ ] **Step 1: `README.md` (Windows) anpassen**

- Überschrift `# Pi Desk für Windows · 0.4.0`
- Abschnitt „Start auf Windows“: Schritte 1–2 durch „`Pi-Desk-0.4.0-Windows-x64-Setup.exe` ausführen (keine Administratorrechte). Pi Desk aus Startmenü oder Desktopverknüpfung öffnen.“ ersetzen.
- Den Satz „Das Paket ist nicht signiert und enthält keinen automatischen Updater. Es ist ein ZIP mit startbarer EXE, kein Setup-Installer.“ ersetzen durch: „Das Setup ist nicht signiert; SmartScreen kann beim ersten Start warnen. Bisherige ZIP-Nutzer installieren einmal das Setup; Daten unter `%LOCALAPPDATA%\Pi Desk` bleiben erhalten.“
- Neuer Abschnitt nach „Bedienung“:

```markdown
## Updates

Pi Desk sucht 10 Sekunden nach dem Start und danach alle 6 Stunden nach einer neuen Version. Gibt es eine, erscheint der Changelog mit **Jetzt aktualisieren**, **Später** und **Diese Version überspringen**. Während ein Agent arbeitet oder eine Anmeldung läuft, wird nur geladen und beim nächsten Beenden installiert. **Einstellungen → Updates** schaltet die automatische Suche ab oder prüft sofort; ebenso **Datei → Nach Updates suchen …**.

Quelle ist `updates/windows/latest.yml` in diesem Repository; das Setup selbst ist ein Anhang am GitHub-Release. electron-updater prüft die SHA-512-Prüfsumme. Ohne Code-Signatur hängt die Echtheit an der Sicherheit des GitHub-Kontos. Protokoll: `%LOCALAPPDATA%\Pi Desk\desktop\logs\updates.log`.
```

- Abschnitt „Selbst bauen“: `npm run build:win` erzeugt das NSIS-Setup und läuft nur unter Windows. Den Absatz zu `build:installer` und zum Intel-NSIS-Compiler ersetzen durch einen Release-Abschnitt:

```markdown
## Release veröffentlichen

1. Version in `package.json` erhöhen, Abschnitt in `CHANGELOG.md` schreiben, committen und pushen.
2. GitHub → Actions → **Windows-Release** → *Run workflow* (oder `gh workflow run windows-release.yml`). Ergebnis: Entwurfs-Release `windows-vX.Y.Z`.
3. `npm run release:feed` schreibt `updates/windows/latest.yml` lokal. Entwurf herunterladen und testen.
4. `npm run release:publish` veröffentlicht nach Rückfrage das Release und pusht den Feed. Ab dann sehen Nutzer das Update.

Zurückrollen: Feed-Commit zurücksetzen. Bereits aktualisierte Installationen bleiben auf der Version.
```

- [ ] **Step 2: `WINDOWS-TESTPLAN.md` – Abschnitt „Updates“ anhängen**

```markdown
## Updates (ab 0.4.0)

1. Bisherige ZIP-Version 0.3.0 mit einem Chat starten, beenden. Setup 0.4.0 installieren, starten: Chat und Anmeldung sind noch da.
2. Einstellungen → Updates: Version 0.4.0, „Automatisch nach Updates suchen“ an. „Jetzt nach Updates suchen“ → „Pi Desk 0.4.0 ist aktuell“.
3. Sobald 0.4.1 ausgerollt ist: Pi Desk 0.4.0 starten. Nach ca. 10 s erscheint der Dialog mit dem Changelog von 0.4.1.
4. „Später“: Dialog schließt. Er erscheint erst nach erneutem App-Start wieder.
5. „Jetzt aktualisieren“ ohne laufenden Agenten: Fortschritt, Neustart ohne UAC-Abfrage, Einstellungen → Updates zeigt 0.4.1.
6. Mit laufendem Agenten (oder offener Anmeldung) aktualisieren: Hinweis „Das Update wird beim nächsten Beenden installiert“. „Jetzt neu starten“ fragt wie beim Beenden nach.
7. „Diese Version überspringen“: Kein automatischer Dialog mehr für diese Version, manuelle Suche zeigt sie weiterhin.
8. Netzwerk trennen, „Jetzt nach Updates suchen“: verständliche Meldung, App bleibt benutzbar.
9. `%LOCALAPPDATA%\Pi Desk\desktop\logs\updates.log` enthält die Prüfungen.
```

- [ ] **Step 3: `VERIFICATION.md` ergänzen**

Abschnitt „0.4.0 – Updates“ mit: Unit-Tests (`npm test`, Anzahl Tests aus der Ausgabe), Desktop-Smoke inkl. `verification/update.png`, Ergebnis des Actions-Laufs (Run-URL, ob `npm test` auf Windows grün war). Ausdrücklich als **offen** markieren: echte Installation des Setups, Update-Lauf 0.4.0 → 0.4.1, SmartScreen-Verhalten, Busy-Sperre auf Windows (alle aus `WINDOWS-TESTPLAN.md` → Updates).

- [ ] **Step 4: Haupt-README (`repo/README.md`)**

- Download-Zeile Windows: `- [Windows 0.4.0 – Setup für x64](https://github.com/LiLoLama/pi-desk/releases/tag/windows-v0.4.0)` mit dem Zusatz „ab dieser Version mit automatischen Updates; einmalig manuell installieren“.
- Unter „Builds und Releases“ ergänzen: „Update-Feeds liegen unter `updates/` und werden erst beim Ausrollen committet. Ablauf je Plattform im jeweiligen App-README.“

- [ ] **Step 5: Abschlussprüfung**

Run: `npm test && npm run test:desktop`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add README.md VERIFICATION.md WINDOWS-TESTPLAN.md ../../README.md
git commit -m "Windows: Doku für Setup und automatische Updates"
```

- [ ] **Step 7: Ausrollen (nur auf Liams ausdrücklichen Auftrag)**

```bash
npm run release:feed
npm run release:publish
```

Expected: Rückfrage, nach „ja“ ist das Release öffentlich, `updates/windows/latest.yml` gepusht. Prüfen: `curl -s https://raw.githubusercontent.com/LiLoLama/pi-desk/main/updates/windows/latest.yml | head -3` zeigt `version: 0.4.0` (eventuell erst nach ca. 5 Minuten).
