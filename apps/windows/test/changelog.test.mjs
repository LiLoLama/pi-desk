import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {parseChangelog,compareVersions,sectionsNewerThan,renderNotes,section,whatsNew,recentNotes}=createRequire(import.meta.url)('../desktop/changelog.cjs');
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
test('accepts em dash and hyphen as date separators',()=>{
 assert.deepEqual(parseChangelog('## 1.0.0 — 01.01.2026\n\n- A\n\n## 0.9.0 - 02.12.2025\n\n- B').map(e=>[e.version,e.date,e.body]),[['1.0.0','01.01.2026','- A'],['0.9.0','02.12.2025','- B']]);
});
const all='## 0.5.0 – 20.10.2026\n\n- Neu B\n\n## 0.4.1 – 12.10.2026\n\n- Neu A\n- Zweiter Punkt\n\n## 0.4.0\n\n- Alt';
test('whats new: shown once when major or minor grew, with every section in between',()=>{
 assert.deepEqual(whatsNew(text,'0.4.1','0.5.0'),{show:true,notes:'## 0.5.0 – 20.10.2026\n\n- Neu B',remember:'0.5.0'});
 assert.deepEqual(whatsNew(text,'0.3.0','0.5.0'),{show:true,notes:all,remember:'0.5.0'});
 assert.equal(whatsNew('## 0.10.0 – 01.01.2027\n\n- Zehn\n','0.9.3','0.10.0').show,true);
});
test('whats new: silent for patches, same version, downgrades and missing sections',()=>{
 assert.deepEqual(whatsNew(text,'0.4.0','0.4.1'),{show:false,notes:'',remember:'0.4.1'});
 assert.deepEqual(whatsNew(text,'0.5.0','0.5.0'),{show:false,notes:'',remember:'0.5.0'});
 assert.deepEqual(whatsNew(text,'0.5.0','0.4.1'),{show:false,notes:'',remember:'0.4.1'});
 assert.deepEqual(whatsNew(text,'0.5.0','0.6.0'),{show:false,notes:'',remember:'0.6.0'});
});
test('whats new: no or broken seen version only remembers',()=>{
 for(const seen of [undefined,null,'','0.4','0.4.0-beta','kaputt',42])assert.deepEqual(whatsNew(text,seen,'0.5.0'),{show:false,notes:'',remember:'0.5.0'},String(seen));
});
test('whats new: CRLF and hyphen headings',()=>{
 assert.deepEqual(whatsNew(text.replace(/\n/g,'\r\n'),'0.3.0','0.5.0'),{show:true,notes:all,remember:'0.5.0'});
 assert.equal(whatsNew(text.replace('## 0.4.1 – 12.10.2026','## 0.4.1 - 12.10.2026'),'0.3.0','0.5.0').notes,all);
});
test('recent notes: up to the installed version, newest first, at most ten',()=>{
 assert.equal(recentNotes(text,'0.4.1'),'## 0.4.1 – 12.10.2026\n\n- Neu A\n- Zweiter Punkt\n\n## 0.4.0\n\n- Alt');
 const many=Array.from({length:12},(_,i)=>`## 0.${i}.0\n\n- Punkt ${i}`).join('\n\n');
 const notes=recentNotes(many,'0.11.0');
 assert.equal((notes.match(/^## /gm)||[]).length,10);assert.ok(notes.startsWith('## 0.11.0'));
 assert.equal(recentNotes('','0.4.0'),'');
});
test('the installer ships CHANGELOG.md',()=>{
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 assert.ok(pkg.build.files.includes('CHANGELOG.md'));
});
