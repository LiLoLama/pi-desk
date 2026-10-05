import test from 'node:test';
import assert from 'node:assert/strict';
import {parseChangelog,section,renderEntry,bundleVersion} from '../scripts/changelog.mjs';

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
