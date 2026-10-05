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
