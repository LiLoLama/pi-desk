import test from 'node:test';
import assert from 'node:assert/strict';
import YAML from 'yaml';
import {feedFromRelease} from '../scripts/release-feed.mjs';
import {releaseNotes} from '../scripts/release-notes.mjs';
import {checkDraft} from '../scripts/release-publish.mjs';
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
 assert.match(notes,/^- Updates/);assert.match(notes,/SmartScreen/);assert.match(notes,/„Nur für mich“ wählen/);assert.doesNotMatch(notes,/Zukunft/);
});
const name='Pi-Desk-0.4.0-Windows-x64-Setup.exe',feedYaml=feedFromRelease(latest,{tag:'windows-v0.4.0',version:'0.4.0',changelog});
const view=(over={})=>({isDraft:true,assets:[{name:'latest.yml',size:9},{name,size:123}],...over});
test('publish check accepts a draft whose installer matches the feed size',()=>{
 assert.deepEqual(checkDraft(view(),feedYaml,'0.4.0'),['latest.yml',name]);
});
test('publish check refuses a live release, a missing installer and a size mismatch',()=>{
 assert.throws(()=>checkDraft(view({isDraft:false}),feedYaml,'0.4.0'),/kein Entwurf/);
 assert.throws(()=>checkDraft(view({assets:[{name:'latest.yml',size:9}]}),feedYaml,'0.4.0'),/fehlt/);
 assert.throws(()=>checkDraft(view({assets:[{name,size:124}]}),feedYaml,'0.4.0'),/123/);
});
test('publish check refuses a feed for another version or without a size',()=>{
 assert.throws(()=>checkDraft(view(),feedYaml,'0.4.1'),/Feed nennt nicht 0\.4\.1/);
 assert.throws(()=>checkDraft(view(),feedYaml.replace(/ +size: 123\n/,''),'0.4.0'),/Größe/);
});
