import test from 'node:test';
import assert from 'node:assert/strict';
import {parseChangelog,section,renderEntry,bundleVersion} from '../scripts/changelog.mjs';
import {appcastItem,addItem,parseSignature} from '../scripts/appcast.mjs';

const changelog = '# Änderungen\n\n## 0.3.1 – 12.10.2026\n\n- Fehler behoben\n\n## 0.3.0 – 05.10.2026\n\n- Updates\n- Notarisiert\n';

test('changelog sections and build numbers', () => {
  assert.deepEqual(parseChangelog(changelog).map(e => e.version), ['0.3.1', '0.3.0']);
  assert.equal(section(changelog, '0.3.0').body, '- Updates\n- Notarisiert');
  assert.throws(() => section(changelog, '0.4.0'), /keinen Abschnitt für 0\.4\.0/);
  assert.throws(() => section('## 0.4.0\n\n', '0.4.0'), /keinen Abschnitt/);
  assert.equal(renderEntry(section(changelog, '0.3.1')), '## 0.3.1 – 12.10.2026\n\n- Fehler behoben');
  assert.equal(bundleVersion('0.3.0'), '300');
  assert.equal(bundleVersion('1.2.3'), '10203');
  assert.equal(bundleVersion('0.10.0'), '1000');
  assert.throws(() => bundleVersion('0.100.0'), /< 100/);
  assert.throws(() => bundleVersion('0.3'), /X\.Y\.Z/);
  assert.throws(() => bundleVersion('1..3'), /X\.Y\.Z/);
  assert.throws(() => bundleVersion('1.2.3.4'), /X\.Y\.Z/);
  assert.throws(() => bundleVersion('0x1.2.3'), /X\.Y\.Z/);
  assert.throws(() => bundleVersion('-1.2.3'), /X\.Y\.Z/);
});

const item = (version, build, text = '- Neu') => appcastItem({
  version, build, entry: {version, date: '05.10.2026', body: text},
  url: `https://github.com/LiLoLama/pi-desk/releases/download/macos-v${version}/Pi-Desk-${version}-apple-silicon.dmg`,
  length: '123', signature: 'c2ln', date: new Date('2026-10-05T10:00:00Z'),
});

test('appcast items carry version, notes and signature', () => {
  const xml = item('0.3.0', '300', '- A ]]> B');
  assert.match(xml, /<sparkle:version>300<\/sparkle:version>/);
  assert.match(xml, /<sparkle:shortVersionString>0\.3\.0<\/sparkle:shortVersionString>/);
  assert.match(xml, /<sparkle:minimumSystemVersion>14\.0<\/sparkle:minimumSystemVersion>/);
  assert.match(xml, /sparkle:edSignature="c2ln"/);
  assert.match(xml, /length="123"/);
  assert.match(xml, /<pubDate>Mon, 05 Oct 2026 10:00:00 GMT<\/pubDate>/);
  assert.ok(xml.includes('<![CDATA[## 0.3.0 – 05.10.2026\n\n- A ]]]]><![CDATA[> B]]>'));
});

test('new versions go first, duplicates are refused', () => {
  const one = addItem('', item('0.3.0', '300'), '0.3.0');
  assert.match(one, /^<\?xml/);
  assert.match(one, /xmlns:sparkle="http:\/\/www\.andymatuschak\.org\/xml-namespaces\/sparkle"/);
  const two = addItem(one, item('0.3.1', '301'), '0.3.1');
  assert.ok(two.indexOf('0.3.1</sparkle:shortVersionString>') < two.indexOf('0.3.0</sparkle:shortVersionString>'));
  assert.throws(() => addItem(two, item('0.3.1', '301'), '0.3.1'), /bereits/);
  assert.throws(() => addItem('<rss></rss>', item('0.3.2', '302'), '0.3.2'), /unerwartetes Format/);
});

test('reads sign_update output', () => {
  assert.deepEqual(parseSignature('sparkle:edSignature="abc+/=" length="155724006"\n'), {signature: 'abc+/=', length: '155724006'});
  assert.throws(() => parseSignature('error'), /keine Signatur/);
});
