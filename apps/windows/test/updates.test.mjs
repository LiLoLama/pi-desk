import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const {createUpdates,fileStore,FIRST_CHECK,INTERVAL}=createRequire(import.meta.url)('../desktop/updates.cjs');
const notes='## 0.5.0 – 20.10.2026\n\n- Neu B\n\n## 0.4.1 – 12.10.2026\n\n- Neu A\n\n## 0.4.0 – 05.10.2026\n\n- Alt';
function fakeUpdater(){const u=new EventEmitter();u.calls=[];u.setFeedURL=o=>u.calls.push(['feed',o]);u.checkForUpdates=async()=>{u.calls.push(['check']);await u.onCheck?.();};u.downloadUpdate=async()=>{u.calls.push(['download']);await u.onDownload?.();};return u;}
const memory=(data={})=>({data,read(){return {...this.data};},write(d){this.data={...d};}});
function fakeTimers(){const t={timeouts:[],intervals:[]};t.setTimeout=(f,ms)=>t.timeouts.push([f,ms]);t.setInterval=(f,ms)=>t.intervals.push([f,ms]);return t;}
function setup(store=memory(),installFn){
 const updater=fakeUpdater(),sent=[],timers=fakeTimers(),installs=[];
 const updates=createUpdates({updater,store,current:'0.4.0',feedURL:'https://example.test/feed/',send:s=>sent.push(s),install:installFn||(async options=>{installs.push(options);return true;}),timers,now:()=>new Date('2026-10-05T10:00:00Z')});
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
 updates.later();
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
const settle=()=>new Promise(setImmediate);
const offline=updater=>{updater.onCheck=()=>{updater.emit('error',Error('offline'));throw Error('offline');};};
const checks=updater=>updater.calls.filter(c=>c[0]==='check').length;
test('a failing store never leaves a check hanging',async()=>{
 const store=memory();store.write=()=>{throw Error('EPERM');};
 const {updates,updater}=setup(store);
 updater.onCheck=()=>updater.emit('update-not-available',{version:'0.4.0'});
 assert.equal((await updates.check(true)).phase,'upToDate');
 assert.equal((await updates.check(true)).phase,'upToDate');
 assert.equal(checks(updater),2);
 assert.equal(updates.setAuto(false).auto,false);
 offer(updater);assert.equal((await updates.check(true)).phase,'available');
 assert.equal(updates.skip().phase,'idle');
});
test('timer-driven checks never reject, even when the store fails',async()=>{
 const store=memory();store.write=()=>{throw Error('EPERM');};
 const {updates,updater,timers}=setup(store);
 updater.onCheck=()=>updater.emit('update-not-available',{version:'0.4.0'});
 updates.start();timers.timeouts[0][0]();await settle();timers.intervals[0][0]();await settle();
 assert.equal(updates.status().phase,'idle');assert.equal(checks(updater),2);
});
test('a background check leaves a visible offer untouched',async()=>{
 const {updates,updater,sent}=setup();offer(updater);await updates.check(false);
 const before=sent.length;
 updater.onCheck=()=>updater.emit('update-not-available',{version:'0.4.0'});
 const status=await updates.check(false);
 assert.equal(status.phase,'available');assert.equal(status.version,'0.5.0');
 assert.equal(sent.length,before);assert.equal(checks(updater),1);
});
test('background checks never announce checking; manual checks do',async()=>{
 const {updates,updater,sent}=setup();
 updater.onCheck=()=>updater.emit('update-not-available',{version:'0.4.0'});
 await updates.check(false);
 assert.ok(!sent.some(s=>s.phase==='checking'));
 await updates.check(true);
 assert.ok(sent.some(s=>s.phase==='checking'));
});
test('a manual check during a running background check shows its result',async()=>{
 const {updates,updater}=setup();let second;
 updater.onCheck=async()=>{second=await updates.check(true);updater.emit('update-not-available',{version:'0.4.0'});};
 const first=await updates.check(false);
 assert.equal(second.phase,'checking');assert.equal(checks(updater),1);
 assert.equal(first.phase,'upToDate');
});
test('closing an upToDate or error result frees background checks again',async()=>{
 const {updates,updater}=setup();
 updater.onCheck=()=>updater.emit('update-not-available',{version:'0.4.0'});
 assert.equal((await updates.check(true)).phase,'upToDate');
 assert.equal((await updates.check(false)).phase,'upToDate');assert.equal(checks(updater),1);
 assert.equal(updates.later().phase,'idle');
 assert.equal((await updates.check(false)).phase,'idle');assert.equal(checks(updater),2);
 offline(updater);
 assert.equal((await updates.check(true)).phase,'error');
 assert.equal((await updates.check(false)).phase,'error');assert.equal(checks(updater),3);
 assert.equal(updates.later().phase,'idle');
 assert.equal((await updates.check(false)).phase,'idle');assert.equal(checks(updater),4);
});
test('later does not touch phases that are not dismissible',async()=>{
 const {updates,updater}=setup();offer(updater);await updates.check(false);
 updater.onDownload=()=>settle();
 const pending=updates.download();
 assert.equal(updates.later().phase,'downloading');await pending;
});
test('a download that ends without update-downloaded counts as failed',async()=>{
 const {updates,updater}=setup();offer(updater);await updates.check(false);
 updater.onDownload=()=>{};
 const status=await updates.download();
 assert.equal(status.phase,'error');
 assert.equal(status.error,'Das Update konnte nicht geladen oder bestätigt werden. Es wurde nichts verändert.');
});
test('skip outside an offer keeps a persisted skip',()=>{
 const store=memory({skipped:'0.5.0'});const {updates}=setup(store);
 assert.equal(updates.skip().phase,'idle');
 assert.equal(store.data.skipped,'0.5.0');
 updates.setAuto(true);assert.equal(store.data.skipped,'0.5.0');
});
test('a failing check is reported like the real updater: error event and rejection',async()=>{
 const {updates,updater}=setup();offline(updater);
 assert.equal((await updates.check(false)).phase,'idle');
 const failed=await updates.check(true);
 assert.equal(failed.phase,'error');assert.match(failed.error,/nicht erreichbar/);
});
test('a stray error after a finished manual check stays silent',async()=>{
 const {updates,updater}=setup();
 updater.onCheck=()=>updater.emit('update-not-available',{version:'0.4.0'});
 await updates.check(true);updates.later();
 updater.emit('error',Error('late'));
 assert.equal(updates.status().phase,'idle');
});
test('a throwing automatic install cannot break the download flow',async()=>{
 const {updates,updater}=setup(memory(),()=>{throw Error('boom');});offer(updater);await updates.check(false);
 updater.onDownload=()=>updater.emit('update-downloaded',{version:'0.5.0'});
 assert.equal((await updates.download()).phase,'ready');await settle();
 assert.equal(updates.status().phase,'ready');
});
test('installNow resolves with a status even when install rejects',async()=>{
 const {updates,updater}=setup(memory(),async()=>{throw Error('boom');});offer(updater);await updates.check(false);
 updater.onDownload=()=>updater.emit('update-downloaded',{version:'0.5.0'});
 await updates.download();await settle();
 assert.equal((await updates.installNow()).phase,'ready');
});
test('the file store reads a broken JSON file as empty',()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'pi-updates-'));const file=path.join(dir,'updates.json');
 writeFileSync(file,'{"auto":false,');assert.deepEqual(fileStore(file).read(),{});
});
