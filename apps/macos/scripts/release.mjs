// Release flow: `draft` builds, notarizes and uploads an unpublished GitHub release; `publish` makes it live after confirmation.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,rm,symlink,writeFile} from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import {fileURLToPath} from 'node:url';
import {section,bundleVersion} from './changelog.mjs';
import {appcastItem,addItem,parseSignature} from './appcast.mjs';

const REPO = 'LiLoLama/pi-desk';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(root, '../..');
const run = (command, args, {capture = false, cwd = root} = {}) => {
  const result = spawnSync(command, args, {cwd, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit'});
  if (result.status !== 0) throw Error(`${path.basename(command)} ${args[0] || ''} fehlgeschlagen`);
  return (result.stdout || '').trim();
};
const {version} = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const tag = `macos-v${version}`;
const dist = path.join(root, 'dist');
const app = path.join(dist, 'Pi Desk.app');
const dmgName = `Pi-Desk-${version}-apple-silicon.dmg`;
const dmg = path.join(dist, dmgName);
const feed = path.join(repo, 'updates', 'macos', 'appcast.xml');
const entry = section(await readFile(path.join(root, 'CHANGELOG.md'), 'utf8'), version);

async function draft() {
  const signId = process.env.PI_DESK_SIGN_ID, profile = process.env.PI_DESK_NOTARY_PROFILE;
  if (!signId || !profile) throw Error('PI_DESK_SIGN_ID und PI_DESK_NOTARY_PROFILE setzen (Plan, Task 7).');
  if (process.env.PI_DESK_TEST_FEED_BUILD) throw Error('PI_DESK_TEST_FEED_BUILD ist gesetzt. Release-Builds dürfen keinen Testfeed annehmen.');
  run('node', ['scripts/install-sparkle.mjs']);
  run('python3', ['native/build.py']);
  const plist = path.join(app, 'Contents', 'Info.plist');
  const build = run('plutil', ['-extract', 'CFBundleVersion', 'raw', plist], {capture: true});
  if (build !== bundleVersion(version)) throw Error(`Build-Nummer ${build} passt nicht zu ${version}.`);
  if (spawnSync('plutil', ['-extract', 'PIDeskDevBuild', 'raw', plist]).status === 0) throw Error('Build nimmt einen Testfeed an und darf nicht veröffentlicht werden.');
  // Notarize the app itself so its ticket stays stapled after Sparkle copies it out of the DMG.
  const zip = path.join(dist, 'notarize-app.zip');
  run('ditto', ['-c', '-k', '--keepParent', app, zip]);
  run('xcrun', ['notarytool', 'submit', zip, '--keychain-profile', profile, '--wait']);
  await rm(zip);
  run('xcrun', ['stapler', 'staple', app]);
  const stage = path.join(dist, 'dmg-stage');
  await rm(stage, {recursive: true, force: true});
  await mkdir(stage);
  run('ditto', [app, path.join(stage, 'Pi Desk.app')]);
  await symlink('/Applications', path.join(stage, 'Programme'));
  await writeFile(path.join(stage, 'Lesen.txt'), `Pi Desk ${version} · Apple Silicon · macOS 14 oder neuer

1. Pi Desk in den Ordner Programme ziehen.
2. Pi Desk aus dem Programme-Ordner starten.

Updates kommen danach automatisch: Pi Desk zeigt vor jeder Installation, was neu ist.
Die App enthält Node und OMP 18.4.10. Keine zusätzliche Installation nötig.
Intel-Macs werden nicht unterstützt.
`);
  await rm(dmg, {force: true});
  run('hdiutil', ['create', '-volname', 'Pi Desk', '-srcfolder', stage, '-ov', '-format', 'UDZO', dmg]);
  run('codesign', ['--force', '--sign', signId, '--timestamp', dmg]);
  run('xcrun', ['notarytool', 'submit', dmg, '--keychain-profile', profile, '--wait']);
  run('xcrun', ['stapler', 'staple', dmg]);
  run('spctl', ['--assess', '--type', 'execute', '--verbose', app]);
  run('spctl', ['--assess', '--type', 'open', '--context', 'context:primary-signature', '--verbose', dmg]);
  const {signature, length} = parseSignature(run(path.join(root, 'vendor/sparkle/bin/sign_update'), [dmg], {capture: true}));
  const sums = path.join(dist, 'SHA256SUMS-macos.txt');
  await writeFile(sums, `${createHash('sha256').update(await readFile(dmg)).digest('hex')}  ${dmgName}\n`);
  const notes = path.join(dist, 'release-notes.md');
  await writeFile(notes, `${entry.body}\n\n---\nApple Silicon, macOS 14 oder neuer. Developer-ID-signiert und notarisiert. Ab dieser Version aktualisiert sich Pi Desk selbst. SHA-256 in SHA256SUMS-macos.txt.\n`);
  run('gh', ['release', 'create', tag, dmg, sums, '--repo', REPO, '--draft', '--prerelease', '--target', 'main', '--title', `Pi Desk für macOS ${version} (Apple Silicon)`, '--notes-file', notes]);
  const url = `https://github.com/${REPO}/releases/download/${tag}/${dmgName}`;
  const existing = await readFile(feed, 'utf8').catch(() => '');
  await mkdir(path.dirname(feed), {recursive: true});
  await writeFile(feed, addItem(existing, appcastItem({version, build, entry, url, length, signature}), version));
  console.log(`Entwurf ${tag} angelegt, Feed lokal aktualisiert (updates/macos/appcast.xml).\nEntwurf testen, dann: npm run release:publish`);
}

async function publish() {
  const relative = path.relative(repo, feed);
  if (run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {capture: true, cwd: repo}) !== 'main') throw Error('Ausrollen nur vom Branch main.');
  if (!run('git', ['status', '--porcelain', '--', relative], {capture: true, cwd: repo})) throw Error('Keine Feed-Änderung. Zuerst npm run release:draft.');
  if (!(await readFile(feed, 'utf8')).includes(`<sparkle:shortVersionString>${version}</sparkle:shortVersionString>`)) throw Error(`Feed enthält ${version} nicht.`);
  console.log(run('gh', ['release', 'view', tag, '--repo', REPO, '--json', 'isDraft,assets', '--jq', '"Entwurf: "+(.isDraft|tostring)+" · Anhänge: "+([.assets[].name]|join(", "))'], {capture: true}));
  const rl = readline.createInterface({input: process.stdin, output: process.stdout});
  const answer = (await rl.question(`Pi Desk ${version} jetzt an alle Mac-Nutzer ausrollen? (ja/nein) `)).trim().toLowerCase();
  rl.close();
  if (answer !== 'ja') return console.log('Abgebrochen. Nichts veröffentlicht.');
  run('gh', ['release', 'edit', tag, '--repo', REPO, '--draft=false']);
  run('git', ['add', '--', relative], {cwd: repo});
  run('git', ['commit', '-m', `macOS ${version} ausrollen`, '--', relative], {cwd: repo});
  run('git', ['push'], {cwd: repo});
  console.log('Ausgerollt. Nutzer sehen das Update spätestens nach ihrer nächsten Prüfung (raw-Cache ca. 5 Minuten).');
}

const command = process.argv[2];
if (command === 'draft') await draft();
else if (command === 'publish') await publish();
else {
  console.error('Verwendung: node scripts/release.mjs draft|publish');
  process.exit(1);
}
