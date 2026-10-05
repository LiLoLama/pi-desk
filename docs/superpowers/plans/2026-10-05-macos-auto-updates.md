# macOS: Automatische Updates – Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die native Mac-App prüft über Sparkle selbst auf Updates, zeigt den Changelog in einem Quiet-Studio-Dialog und installiert nach Bestätigung. Releases sind Developer-ID-signiert und notarisiert.

**Architecture:** Sparkle 2.10.0 wird gepinnt nach `vendor/` geladen, gegen `swiftc` gelinkt und in `Contents/Frameworks` eingebettet. `native/UpdateLogic.swift` enthält testbare Regeln, `native/Updates.swift` implementiert `SPUUserDriver` mit SwiftUI-Dialog und Einstellungsseite. `scripts/release.mjs` baut, notarisiert, signiert per EdDSA, legt ein Entwurfs-Release an und schreibt `updates/macos/appcast.xml`. `publish` rollt nach Rückfrage aus.

**Tech Stack:** Swift 5 / SwiftUI / AppKit (macOS 14, arm64, `swiftc` ohne Xcode-Projekt), Sparkle 2.10.0, Python-Build `native/build.py`, Node 22 `node:test`, `xcrun notarytool`, `gh`.

Spec: [2026-10-05-auto-updates-design.md](../specs/2026-10-05-auto-updates-design.md)

## Global Constraints

- Arbeitsverzeichnis für alle Befehle: `apps/macos` (außer wo `repo/` genannt ist).
- Deutsch in UI und Doku, echte Umlaute. Codekommentare englisch und knapp wie im Bestand. Swift mit 2 Leerzeichen eingerückt wie `native/*.swift`.
- Quiet Studio Dark: Hintergrund `Color(red: 0.105, green: 0.114, blue: 0.118)`, Akzent `Color(red: 0.73, green: 0.81, blue: 0.72)`, `.preferredColorScheme(.dark)`, `NSAppearance(named: .darkAqua)`.
- Beenden- und Genehmigungsabläufe nicht umgehen. Ein Neustart fürs Update fragt bei laufender Arbeit wie das Beenden nach. Automatische Installationen warten.
- Sparkle: Version `2.10.0`, Archiv-SHA-256 `c2bf58aa8387266ac179357b1415d6f2635f044da8be41042af32425dae6da0c`.
- Feed: `https://raw.githubusercontent.com/LiLoLama/pi-desk/main/updates/macos/appcast.xml`
- Release-Asset: `https://github.com/LiLoLama/pi-desk/releases/download/macos-vX.Y.Z/Pi-Desk-X.Y.Z-apple-silicon.dmg`
- Signier-ID: `Developer ID Application: LIAM SCHMID (G5FFT759WM)` (im Schlüsselbund vorhanden). Notarisierungsprofil im Schlüsselbund: `pi-desk-notary`. Übergabe per `PI_DESK_SIGN_ID` und `PI_DESK_NOTARY_PROFILE`.
- Build-Nummer: `CFBundleVersion = major*10000 + minor*100 + patch`. Minor und Patch müssen < 100 sein.
- Prüfintervall: erste Prüfung 10 s nach Start, danach `SUScheduledCheckInterval = 21600`.
- Erste Version mit Updater: **0.3.0**.
- Keine gemeinsamen Module mit `apps/windows` (AGENTS.md).
- Zugangsdaten, private Schlüssel und `vendor/` nie einchecken. Der öffentliche EdDSA-Schlüssel (`native/sparkle-public-key.txt`) wird eingecheckt.
- **Commits, Pushes und Releases nur mit ausdrücklicher Freigabe von Liam.** Commit-Schritte werden erst nach dieser Freigabe ausgeführt, sonst übersprungen. Commit-Nachrichten enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Schritte mit **(Liam)** erfordern Liams Schlüsselbund, Apple-ID oder ein Passwort. Der Agent führt sie nicht aus, sondern gibt Liam den Befehl und wartet.

## Dateiübersicht

| Datei | Aufgabe |
|---|---|
| `scripts/changelog.mjs` (neu) | Changelog lesen, Abschnitt prüfen, rendern, Build-Nummer berechnen |
| `scripts/appcast.mjs` (neu) | Appcast-Eintrag erzeugen, in Feed einfügen, `sign_update`-Ausgabe lesen |
| `scripts/install-sparkle.mjs` (neu) | Sparkle gepinnt und geprüft nach `vendor/sparkle` laden |
| `scripts/release.mjs` (neu) | `draft` (Build, Notarisierung, DMG, EdDSA, Entwurfs-Release, Feed) und `publish` |
| `native/UpdateLogic.swift` (neu) | Reine Regeln: Versionsvergleich, Notizen filtern, ersetzbarer Ort |
| `native/Updates.swift` (neu) | `AppUpdates` (Zustand), `UpdateDriver` (`SPUUserDriver`), `UpdateView`, `UpdateSettingsView` |
| `native/node.entitlements` (neu) | JIT-Rechte für das gebündelte Node unter Hardened Runtime |
| `native/sparkle-public-key.txt` (neu) | Öffentlicher EdDSA-Schlüssel |
| `native/build.py` | Version aus `package.json`, Sparkle linken und einbetten, `Info.plist`, Signierung |
| `native/PiDesk.swift` | `Desk.updateBlocked`, `Desk.confirmQuitWhileBusy()`, Start, Menüpunkt, Beenden-Prüfung |
| `native/Settings.swift` | Bereich „Updates“ |
| `package.json` | `version`, Skripte |
| `CHANGELOG.md` (neu), `licenses/SPARKLE-LICENSE.txt` (neu), `.gitignore` | |
| `test/release.test.mjs`, `test/update-logic.test.mjs`, `test/update-logic-checks.swift` (neu) | Tests |
| `README.md`, `VERIFICATION.md`, `repo/README.md` | Doku |

---

### Task 1: Version an einer Stelle und Changelog

**Files:**
- Create: `scripts/changelog.mjs`, `CHANGELOG.md`
- Modify: `package.json`, `native/build.py`
- Test: `test/release.test.mjs`

**Interfaces:**
- Produces (ESM, `scripts/changelog.mjs`):
  - `parseChangelog(text) → Array<{version, date, body}>`
  - `section(text, version) → entry` (wirft `CHANGELOG.md enthält keinen Abschnitt für X.Y.Z.`)
  - `renderEntry(entry) → string` (`## X.Y.Z – Datum\n\nText`)
  - `bundleVersion(version) → string` (`'0.3.0' → '300'`, wirft bei ungültiger Version)
- `package.json` → `version` ist die einzige Versionsquelle für `build.py` und Release-Skript.

- [ ] **Step 1: Failing test schreiben**

`test/release.test.mjs`:

```js
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
});
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Run: `node --test test/release.test.mjs`
Expected: FAIL (`Cannot find module '…/scripts/changelog.mjs'`)

- [ ] **Step 3: `scripts/changelog.mjs`**

```js
// User-facing release notes: CHANGELOG.md sections "## X.Y.Z – DD.MM.YYYY".
const heading = /^## (\d+\.\d+\.\d+)(?:\s+[–-]\s+(.+?))?\s*$/;

export function parseChangelog(text) {
  const entries = [];
  let current = null;
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const match = line.match(heading);
    if (match) {
      current = {version: match[1], date: match[2] || '', lines: []};
      entries.push(current);
    } else if (current) current.lines.push(line);
  }
  return entries.map(({lines, ...entry}) => ({...entry, body: lines.join('\n').trim()}));
}

export function section(text, version) {
  const entry = parseChangelog(text).find(e => e.version === version);
  if (!entry?.body) throw Error(`CHANGELOG.md enthält keinen Abschnitt für ${version}.`);
  return entry;
}

export const renderEntry = entry => `## ${entry.version}${entry.date ? ` – ${entry.date}` : ''}\n\n${entry.body}`;

// Sparkle compares CFBundleVersion; build.py derives the same number.
export function bundleVersion(version) {
  const parts = String(version).split('.').map(Number);
  if (parts.length !== 3 || !parts.every(n => Number.isInteger(n) && n >= 0)) throw Error(`Version ${version} muss X.Y.Z sein.`);
  if (parts[1] > 99 || parts[2] > 99) throw Error(`Version ${version}: Y und Z müssen < 100 sein.`);
  return String(parts[0] * 10000 + parts[1] * 100 + parts[2]);
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `node --test test/release.test.mjs`
Expected: PASS

- [ ] **Step 5: `CHANGELOG.md` anlegen**

Das Datum der 0.3.0 wird in Task 7 auf den Release-Tag gesetzt.

```markdown
# Pi Desk für macOS – Änderungen

## 0.3.0 – 05.10.2026

- Pi Desk sucht jetzt selbst nach Updates und zeigt vor dem Aktualisieren, was neu ist.
- Neue Einstellungsseite „Updates“: automatische Suche ein- oder ausschalten und jederzeit manuell prüfen.
- Die App ist mit Developer ID signiert und von Apple notariell beglaubigt. Die Gatekeeper-Warnung beim ersten Start entfällt.
- Wichtig: Diese Version einmalig von Hand installieren. Danach kommen Updates automatisch.

## 0.2.0 – 02.10.2026

- Oh My Pi 18.4.10 integriert.
- Die Agentenaktivität wird während der Arbeit erklärt.

## 0.1.0 – 29.09.2026

- Erste Vorabversion für Apple-Silicon-Macs.
```

- [ ] **Step 6: `package.json`**

Ersetzen durch (einzeilig wie bisher):

```json
{"name":"pi-desk","version":"0.3.0","private":true,"type":"module","scripts":{"start":"node server.mjs","test":"node --test test/*.test.mjs","sparkle":"node scripts/install-sparkle.mjs","release:draft":"node scripts/release.mjs draft","release:publish":"node scripts/release.mjs publish"},"engines":{"node":">=22"},"dependencies":{"yaml":"2.8.2"}}
```

- [ ] **Step 7: `native/build.py` liest die Version**

Importzeile ersetzen:

```python
import shutil, subprocess, plistlib, hashlib, os, json
```

Nach `for folder in [resources,macos]:folder.mkdir(parents=True,exist_ok=True)` einfügen:

```python
version=json.loads((root/'package.json').read_text())['version']
major,minor,patch=(int(part) for part in version.split('.'))
if not (0<=minor<100 and 0<=patch<100): raise SystemExit('Version X.Y.Z mit Y, Z < 100 erforderlich (Build-Nummer).')
build_number=str(major*10000+minor*100+patch)
```

Im `info`-Dict `'CFBundleVersion':'2','CFBundleShortVersionString':'0.2.0'` ersetzen durch `'CFBundleVersion':build_number,'CFBundleShortVersionString':version`.

`(resources/'BUILD.txt').write_text('Pi Desk 0.2.0\n…')` ersetzen durch:

```python
(resources/'BUILD.txt').write_text(f'Pi Desk {version} ({build_number})\nSwiftUI / AppKit\nmacOS 14+, Apple Silicon\nOMP 18.4.10\nLocal ad-hoc signature, not notarized.\n')
```

- [ ] **Step 8: Build und Werte prüfen**

Run: `npm test && python3 native/build.py && plutil -extract CFBundleShortVersionString raw "dist/Pi Desk.app/Contents/Info.plist" && plutil -extract CFBundleVersion raw "dist/Pi Desk.app/Contents/Info.plist"`
Expected: Tests PASS, Build endet mit dem App-Pfad, Ausgabe `0.3.0` und `300`.

- [ ] **Step 9: Commit**

```bash
git add scripts/changelog.mjs CHANGELOG.md package.json native/build.py test/release.test.mjs
git commit -m "macOS: Version aus package.json, Changelog"
```

---

### Task 2: Appcast-Erzeugung

**Files:**
- Create: `scripts/appcast.mjs`
- Test: `test/release.test.mjs` (erweitern)

**Interfaces:**
- Consumes: `renderEntry` (Task 1)
- Produces (ESM, `scripts/appcast.mjs`):
  - `appcastItem({version, build, entry, url, length, signature, minimumSystemVersion = '14.0', date = new Date()}) → string`
  - `addItem(existingXml: string, item: string, version: string) → string` (neueste zuerst, legt Feed an, wenn `existingXml` leer ist)
  - `parseSignature(signUpdateOutput: string) → {signature, length}`

- [ ] **Step 1: Failing tests anhängen**

An `test/release.test.mjs` anhängen. Die Importzeile kommt zu den anderen Importen an den Dateianfang.

```js
import {appcastItem,addItem,parseSignature} from '../scripts/appcast.mjs';

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
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Run: `node --test test/release.test.mjs`
Expected: FAIL (`Cannot find module '…/scripts/appcast.mjs'`)

- [ ] **Step 3: `scripts/appcast.mjs`**

```js
// Sparkle appcast for updates/macos/appcast.xml. Descriptions hold Markdown; the app renders it natively.
import {renderEntry} from './changelog.mjs';

const attr = value => String(value).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const cdata = value => `<![CDATA[${String(value).replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;
const empty = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>Pi Desk für macOS</title>
  </channel>
</rss>
`;

export function appcastItem({version, build, entry, url, length, signature, minimumSystemVersion = '14.0', date = new Date()}) {
  return [
    '    <item>',
    `      <title>Pi Desk ${attr(version)}</title>`,
    `      <pubDate>${date.toUTCString()}</pubDate>`,
    `      <sparkle:version>${attr(build)}</sparkle:version>`,
    `      <sparkle:shortVersionString>${attr(version)}</sparkle:shortVersionString>`,
    `      <sparkle:minimumSystemVersion>${attr(minimumSystemVersion)}</sparkle:minimumSystemVersion>`,
    `      <description>${cdata(renderEntry(entry))}</description>`,
    `      <enclosure url="${attr(url)}" length="${attr(length)}" type="application/octet-stream" sparkle:edSignature="${attr(signature)}"/>`,
    '    </item>',
  ].join('\n');
}

export function addItem(existing, item, version) {
  const feed = existing || empty;
  if (feed.includes(`<sparkle:shortVersionString>${attr(version)}</sparkle:shortVersionString>`)) throw Error(`Version ${version} steht bereits im Appcast.`);
  const titleEnd = feed.indexOf('</title>') + '</title>'.length;
  if (titleEnd < '</title>'.length || !feed.includes('</channel>')) throw Error('Appcast hat ein unerwartetes Format.');
  return feed.slice(0, titleEnd) + '\n' + item + feed.slice(titleEnd);
}

export function parseSignature(output) {
  const signature = output.match(/sparkle:edSignature="([^"]+)"/)?.[1];
  const length = output.match(/length="(\d+)"/)?.[1];
  if (!signature || !length) throw Error('sign_update lieferte keine Signatur.');
  return {signature, length};
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `node --test test/release.test.mjs`
Expected: PASS (4 Tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/appcast.mjs test/release.test.mjs
git commit -m "macOS: Appcast-Erzeugung für Sparkle"
```

---

### Task 3: Testbare Update-Regeln in Swift

**Files:**
- Create: `native/UpdateLogic.swift`
- Create: `test/update-logic.test.mjs`, `test/update-logic-checks.swift`
- Modify: `native/build.py` (Quellenliste)

**Interfaces:**
- Produces (Swift, `enum UpdateLogic`):
  - `static func compare(_ a: String, _ b: String) -> Int` (−1/0/1)
  - `static func notes(_ items: [(version: String, notes: String)], newerThan installed: String) -> String`
  - `static func canReplace(bundlePath: String, parentWritable: Bool) -> Bool`

- [ ] **Step 1: Failing test schreiben**

`test/update-logic-checks.swift`:

```swift
func check(_ condition: Bool, _ message: String) {
  if !condition {
    FileHandle.standardError.write(Data("FAIL: \(message)\n".utf8))
    exit(1)
  }
}
check(UpdateLogic.compare("0.10.0", "0.9.9") == 1, "numeric compare")
check(UpdateLogic.compare("0.3.0", "0.3.0") == 0, "equal versions")
check(UpdateLogic.compare("0.3", "0.3.1") == -1, "missing parts count as zero")
let items = [
  (version: "0.3.0", notes: "## 0.3.0\n\n- Alt"),
  (version: "0.4.0", notes: "## 0.4.0\n\n- Neu B\n"),
  (version: "0.3.1", notes: "## 0.3.1\n\n- Neu A"),
  (version: "0.3.2", notes: "  "),
]
check(
  UpdateLogic.notes(items, newerThan: "0.3.0") == "## 0.4.0\n\n- Neu B\n\n## 0.3.1\n\n- Neu A",
  "newer notes, newest first, blanks dropped")
check(UpdateLogic.notes(items, newerThan: "0.4.0").isEmpty, "nothing newer")
check(UpdateLogic.canReplace(bundlePath: "/Applications/Pi Desk.app", parentWritable: true), "Applications")
check(!UpdateLogic.canReplace(bundlePath: "/Volumes/Pi Desk/Pi Desk.app", parentWritable: false), "read-only disk image")
check(
  !UpdateLogic.canReplace(bundlePath: "/private/var/folders/x/AppTranslocation/ABC/d/Pi Desk.app", parentWritable: true),
  "translocated")
print("ok")
```

`test/update-logic.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('native update rules: versions, notes and replaceable locations', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'pi-desk-updates-'));
  try {
    const logic = (await readFile(path.join(root, 'native/UpdateLogic.swift'), 'utf8')).replace(/^import Foundation\n+/, '');
    const checks = await readFile(path.join(root, 'test/update-logic-checks.swift'), 'utf8');
    const file = path.join(tmp, 'update-logic.swift');
    await writeFile(file, `import Foundation\n${logic}\n${checks}\n`);
    const binary = path.join(tmp, 'update-logic');
    const build = spawnSync('swiftc', ['-swift-version', '5', file, '-o', binary, '-module-cache-path', '/private/tmp/pi-desk-swift-cache'], {encoding: 'utf8'});
    assert.equal(build.status, 0, build.stderr || build.stdout);
    const run = spawnSync(binary, {encoding: 'utf8'});
    assert.equal(run.status, 0, run.stderr || run.stdout);
    assert.match(run.stdout, /ok/);
  } finally {
    await rm(tmp, {recursive: true, force: true});
  }
});
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Run: `node --test test/update-logic.test.mjs`
Expected: FAIL (`ENOENT … native/UpdateLogic.swift`)

- [ ] **Step 3: `native/UpdateLogic.swift`**

```swift
import Foundation

/// Pure update rules used by the Sparkle driver; compiled standalone by test/update-logic.test.mjs.
enum UpdateLogic {
  static func compare(_ a: String, _ b: String) -> Int {
    let left = a.split(separator: ".").map { Int($0) ?? 0 }
    let right = b.split(separator: ".").map { Int($0) ?? 0 }
    for index in 0..<max(left.count, right.count) {
      let l = index < left.count ? left[index] : 0
      let r = index < right.count ? right[index] : 0
      if l != r { return l < r ? -1 : 1 }
    }
    return 0
  }

  /// Notes of every offered version newer than the installed one, newest first.
  static func notes(_ items: [(version: String, notes: String)], newerThan installed: String) -> String {
    items.filter { compare($0.version, installed) > 0 }
      .sorted { compare($0.version, $1.version) > 0 }
      .map { $0.notes.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
      .joined(separator: "\n\n")
  }

  /// Sparkle cannot replace an app running from a disk image, a translocated copy or a read-only folder.
  static func canReplace(bundlePath: String, parentWritable: Bool) -> Bool {
    parentWritable && !bundlePath.contains("/AppTranslocation/")
  }
}
```

In `native/build.py` die `sources`-Liste um `'UpdateLogic.swift'` ergänzen (vor `'Extensions.swift'`).

- [ ] **Step 4: Tests und Build**

Run: `node --test test/update-logic.test.mjs && npm test && python3 native/build.py`
Expected: PASS, Build erfolgreich.

- [ ] **Step 5: Commit**

```bash
git add native/UpdateLogic.swift test/update-logic.test.mjs test/update-logic-checks.swift native/build.py
git commit -m "macOS: testbare Update-Regeln"
```

---

### Task 4: Sparkle laden, Schlüssel anlegen, einbetten und signieren

**Files:**
- Create: `scripts/install-sparkle.mjs`, `native/node.entitlements`, `native/sparkle-public-key.txt`, `licenses/SPARKLE-LICENSE.txt`
- Modify: `.gitignore`, `native/build.py`

**Interfaces:**
- Produces:
  - `vendor/sparkle/Sparkle.framework`, `vendor/sparkle/bin/sign_update`, `vendor/sparkle/bin/generate_keys` (nicht eingecheckt)
  - App-Bundle mit `Contents/Frameworks/Sparkle.framework`, rpath `@executable_path/../Frameworks` und den `Info.plist`-Schlüsseln `SUFeedURL`, `SUPublicEDKey`, `SUEnableAutomaticChecks`, `SUScheduledCheckInterval`, `SUAutomaticallyUpdate`, `SUAllowsAutomaticUpdates`. Bei ad-hoc-Builds oder mit `PI_DESK_TEST_FEED_BUILD=1` kommt zusätzlich `PIDeskDevBuild = true` dazu.
  - `sign(path, entitlements=None, preserve=False)` in `build.py`: ad-hoc ohne `PI_DESK_SIGN_ID`, sonst Developer ID mit Hardened Runtime und Zeitstempel

- [ ] **Step 1: `scripts/install-sparkle.mjs`**

```js
// Downloads the pinned Sparkle release into vendor/sparkle (not committed) and verifies its checksum.
import {createHash} from 'node:crypto';
import {mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const version = '2.10.0';
const sha256 = 'c2bf58aa8387266ac179357b1415d6f2635f044da8be41042af32425dae6da0c';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'vendor', 'sparkle');
const stamp = path.join(target, 'VERSION');

if ((await readFile(stamp, 'utf8').catch(() => '')).trim() === version) {
  console.log(`Sparkle ${version} vorhanden`);
} else {
  const response = await fetch(`https://github.com/sparkle-project/Sparkle/releases/download/${version}/Sparkle-${version}.tar.xz`);
  if (!response.ok) throw Error(`Sparkle-Download fehlgeschlagen (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== sha256) throw Error('Unerwartete Sparkle-Prüfsumme');
  await rm(target, {recursive: true, force: true});
  await mkdir(target, {recursive: true});
  const archive = path.join(target, 'sparkle.tar.xz');
  await writeFile(archive, bytes);
  if (spawnSync('tar', ['-xf', archive, '-C', target], {stdio: 'inherit'}).status !== 0) throw Error('Sparkle konnte nicht entpackt werden');
  await rm(archive);
  await writeFile(stamp, version + '\n');
  console.log(`Sparkle ${version} → ${path.relative(root, target)}`);
}
```

`.gitignore` (in `apps/macos`) um eine Zeile `vendor/` ergänzen.

Run: `npm run sparkle && ls vendor/sparkle/Sparkle.framework vendor/sparkle/bin/sign_update && git status --short vendor`
Expected: `Sparkle 2.10.0 → vendor/sparkle`, beide Pfade vorhanden, `git status` zeigt nichts für `vendor`.

Lizenz übernehmen: `cp vendor/sparkle/LICENSE licenses/SPARKLE-LICENSE.txt`

- [ ] **Step 2: EdDSA-Schlüssel anlegen (Liam, einmalig)**

Der Agent gibt Liam diese Befehle und wartet auf Bestätigung:

```bash
vendor/sparkle/bin/generate_keys
```

```bash
vendor/sparkle/bin/generate_keys -p > native/sparkle-public-key.txt
```

```bash
vendor/sparkle/bin/generate_keys -x ~/Desktop/pi-desk-sparkle-private-key.txt
```

Den Inhalt der exportierten Datei im Passwortmanager sichern, z. B. als „Pi Desk Sparkle EdDSA“. Danach die Datei löschen:

```bash
rm ~/Desktop/pi-desk-sparkle-private-key.txt
```

Prüfen (Agent): `wc -c native/sparkle-public-key.txt` → etwa 45 Zeichen (Base64), kein `PRIVATE` im Inhalt.

- [ ] **Step 3: `native/node.entitlements`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
</dict>
</plist>
```

- [ ] **Step 4: `native/build.py` – Sparkle linken, einbetten, `Info.plist`, Signierung**

Nach dem Block zur Build-Nummer aus Task 1 einfügen:

```python
sign_id=os.environ.get('PI_DESK_SIGN_ID','')
sparkle=root/'vendor'/'sparkle'/'Sparkle.framework'
if not sparkle.is_dir(): raise SystemExit('Sparkle fehlt. Zuerst: npm run sparkle')
public_key=(root/'native'/'sparkle-public-key.txt').read_text().strip()
if len(public_key)<40 or 'PRIVATE' in public_key: raise SystemExit('native/sparkle-public-key.txt enthält keinen öffentlichen Sparkle-Schlüssel.')
```

Die `swiftc`-Zeile ersetzen durch:

```python
subprocess.run(['swiftc','-swift-version','5','-parse-as-library','-O','-target','arm64-apple-macosx14.0','-module-cache-path','/private/tmp/pi-desk-swift-cache','-F',str(sparkle.parent)]+[str(root/'native'/name) for name in sources]+['-o',str(macos/'PiDesk'),'-framework','SwiftUI','-framework','AppKit','-framework','Sparkle','-Xlinker','-rpath','-Xlinker','@executable_path/../Frameworks'],check=True)
```

Direkt danach einfügen:

```python
frameworks=app/'Contents'/'Frameworks';frameworks.mkdir(parents=True,exist_ok=True)
shutil.copytree(sparkle,frameworks/'Sparkle.framework',symlinks=True,dirs_exist_ok=True)
```

Nach der `info={…}`-Zeile (vor `with (app/'Contents'/'Info.plist').open('wb')`) einfügen:

```python
info.update({'SUFeedURL':'https://raw.githubusercontent.com/LiLoLama/pi-desk/main/updates/macos/appcast.xml','SUPublicEDKey':public_key,'SUEnableAutomaticChecks':True,'SUScheduledCheckInterval':21600,'SUAutomaticallyUpdate':False,'SUAllowsAutomaticUpdates':False})
# Only development builds accept PI_DESK_UPDATE_FEED as a test feed; release.mjs refuses such builds.
if not sign_id or os.environ.get('PI_DESK_TEST_FEED_BUILD')=='1': info['PIDeskDevBuild']=True
```

Die `BUILD.txt`-Zeile aus Task 1 ersetzen durch:

```python
(resources/'BUILD.txt').write_text(f'Pi Desk {version} ({build_number})\nSwiftUI / AppKit\nmacOS 14+, Apple Silicon\nOMP 18.4.10\n'+('Developer ID signed, notarized for release.\n' if sign_id else 'Local ad-hoc signature, not notarized.\n'))
```

Den bisherigen Signaturblock (Kommentar `# Sign app shell and bundled Node; …` und die drei `codesign`-Aufrufe) ersetzen durch:

```python
def sign(path,entitlements=None,preserve=False):
  command=['codesign','--force','--sign',sign_id or '-']
  if sign_id: command+=['--options','runtime','--timestamp']
  if entitlements and sign_id: command+=['--entitlements',str(entitlements)]
  if preserve: command+=['--preserve-metadata=entitlements']
  subprocess.run(command+[str(path)],check=True)
# Sign inside out. Sparkle's helpers carry our identity; the official OMP binary keeps its own Developer ID signature.
sparkle_bundle=frameworks/'Sparkle.framework'/'Versions'/'B'
sign(sparkle_bundle/'XPCServices'/'Installer.xpc')
sign(sparkle_bundle/'XPCServices'/'Downloader.xpc',preserve=True)
sign(sparkle_bundle/'Autoupdate')
sign(sparkle_bundle/'Updater.app')
sign(frameworks/'Sparkle.framework')
# Bundled Node needs JIT under the hardened runtime.
sign(resources/'node',entitlements=root/'native'/'node.entitlements')
sign(app)
subprocess.run(['codesign','--verify','--deep','--strict',str(app)],check=True)
```

- [ ] **Step 5: Build prüfen**

Run:

```bash
python3 native/build.py
otool -L "dist/Pi Desk.app/Contents/MacOS/PiDesk" | grep Sparkle
plutil -extract SUFeedURL raw "dist/Pi Desk.app/Contents/Info.plist"
plutil -extract PIDeskDevBuild raw "dist/Pi Desk.app/Contents/Info.plist"
open "dist/Pi Desk.app"
```

Expected: `@rpath/Sparkle.framework/Versions/B/Sparkle` in der `otool`-Ausgabe, Feed-URL, `true`. Die App startet und verbindet wie bisher. Danach beenden.

- [ ] **Step 6: Commit**

```bash
git add scripts/install-sparkle.mjs native/node.entitlements native/sparkle-public-key.txt licenses/SPARKLE-LICENSE.txt .gitignore native/build.py
git commit -m "macOS: Sparkle gepinnt einbetten und signieren"
```

---

### Task 5: Sparkle-Treiber, Dialog, Einstellungen, Menü

**Files:**
- Create: `native/Updates.swift`
- Modify: `native/PiDesk.swift` (Desk, AppDelegate, Commands), `native/Settings.swift`, `native/build.py` (Quellenliste)

**Interfaces:**
- Consumes: `UpdateLogic` (Task 3), `ChatMarkdown(text:fontSize:onOpenFile:onRevealFile:onOpenURL:)` aus `Markdown.swift`, `Desk.shared`
- Produces:
  - `@MainActor final class AppUpdates` mit `static let shared`, `start()`, `checkNow()`, `install()`, `later()`, `skip()`, `close()`, `cancelDownloading()`, `restartNow()`, `@Published phase: Phase`, `@Published lastCheck: Date?`, `@Published automaticChecks: Bool`, `installedVersion: String`, `confirmedRestart: Bool`
  - `Desk.updateBlocked: Bool`, `Desk.confirmQuitWhileBusy() -> Bool` (static)
  - `struct UpdateSettingsView: View` (Init `UpdateSettingsView(updates:)`)

- [ ] **Step 1: `Desk` erweitern (`native/PiDesk.swift`)**

In `@MainActor final class Desk` direkt nach `@Published var loginBusy = false` einfügen:

```swift
  /// Work an update restart would interrupt; quitting asks about the same state.
  var updateBlocked: Bool { busy || loginBusy || tasks.contains { $0.busy } }
  static func confirmQuitWhileBusy() -> Bool {
    let alert = NSAlert()
    alert.messageText = "Pi Desk beenden?"
    alert.informativeText =
      "Ein Vorgang läuft noch. Beim Beenden wird er angehalten; gespeicherte Nachrichten bleiben erhalten."
    alert.addButton(withTitle: "Beenden")
    alert.addButton(withTitle: "Weiterarbeiten")
    return alert.runModal() == .alertFirstButtonReturn
  }
```

In `AppDelegate.applicationDidFinishLaunching` die Zeile `Desk.shared.start()` ersetzen durch:

```swift
      Desk.shared.start()
      AppUpdates.shared.start()
```

`applicationShouldTerminate` vollständig ersetzen durch:

```swift
  func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
    MainActor.assumeIsolated {
      guard Desk.shared.updateBlocked, !AppUpdates.shared.confirmedRestart else { return .terminateNow }
      return Desk.confirmQuitWhileBusy() ? .terminateNow : .terminateCancel
    }
  }
```

Hinweis für den Review: Die Beenden-Abfrage berücksichtigt jetzt auch laufende Hintergrundaufgaben (`tasks.contains { $0.busy }`), nicht nur die ausgewählte. Das ist gewollt, sie schützt dieselbe Arbeit wie das Update.

In `PiDeskApp.body` innerhalb von `.commands { … }` als ersten Eintrag einfügen:

```swift
        CommandGroup(after: .appInfo) {
          Button("Nach Updates suchen …") { AppUpdates.shared.checkNow() }
        }
```

- [ ] **Step 2: `native/Updates.swift` anlegen**

```swift
import AppKit
import Sparkle
import SwiftUI

/// Sparkle-backed updates with a Quiet Studio dialog. Sparkle verifies the EdDSA signature; this type decides when to ask.
@MainActor final class AppUpdates: NSObject, ObservableObject, SPUUpdaterDelegate, NSWindowDelegate {
  static let shared = AppUpdates()

  enum Phase: Equatable {
    case idle, checking, upToDate, installing, moveToApplications
    case available(version: String, notes: String)
    case downloading(progress: Double?)
    case extracting(progress: Double)
    case ready(version: String)
    case failed(String)
  }

  @Published private(set) var phase: Phase = .idle
  @Published private(set) var lastCheck: Date?
  @Published var automaticChecks = true {
    didSet {
      if let updater, updater.automaticallyChecksForUpdates != automaticChecks {
        updater.automaticallyChecksForUpdates = automaticChecks
      }
    }
  }
  let installedVersion =
    Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"
  /// Set once the user agreed to interrupt running work, so quitting does not ask twice.
  private(set) var confirmedRestart = false

  private var updater: SPUUpdater?
  private var driver: UpdateDriver?
  private var window: NSWindow?
  private var offered: [(version: String, notes: String)] = []
  private var offeredVersion = ""
  private var dismissedVersion = ""
  private var reply: ((SPUUserUpdateChoice) -> Void)?
  private var cancelDownload: (() -> Void)?
  private var expectedBytes: UInt64 = 0
  private var receivedBytes: UInt64 = 0
  private var userInitiated = false
  private var installWhenFound = false
  private var locationHintShown = false

  func start() {
    let driver = UpdateDriver(model: self)
    let updater = SPUUpdater(hostBundle: .main, applicationBundle: .main, userDriver: driver, delegate: self)
    do { try updater.start() } catch {
      phase = .failed("Updates sind nicht verfügbar: \(error.localizedDescription)")
      return
    }
    self.driver = driver
    self.updater = updater
    automaticChecks = updater.automaticallyChecksForUpdates
    lastCheck = updater.lastUpdateCheckDate
    DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
      guard let updater = self?.updater, updater.automaticallyChecksForUpdates, updater.canCheckForUpdates
      else { return }
      updater.checkForUpdatesInBackground()
    }
  }

  // MARK: User actions

  func checkNow() {
    guard let updater else { return }
    userInitiated = true
    if updater.canCheckForUpdates { updater.checkForUpdates() } else { showWindow() }
  }
  func install() { answer(.install) }
  func later() {
    if case .available(let version, _) = phase { dismissedVersion = version }
    answer(.dismiss)
    finish()
  }
  func skip() {
    answer(.skip)
    finish()
  }
  func close() {
    answer(.dismiss)
    finish()
  }
  func cancelDownloading() {
    cancelDownload?()
    cancelDownload = nil
    finish()
  }
  func restartNow() {
    if Desk.shared.updateBlocked && !Desk.confirmQuitWhileBusy() { return }
    confirmedRestart = true
    if reply != nil {
      answer(.install)
    } else {
      installWhenFound = true
      updater?.checkForUpdates()
    }
  }

  private func answer(_ choice: SPUUserUpdateChoice) {
    let pending = reply
    reply = nil
    pending?(choice)
  }
  private func finish() {
    userInitiated = false
    if case .ready = phase {} else { phase = .idle }
    window?.orderOut(nil)
  }

  // MARK: Sparkle callbacks (main thread)

  func didStartUserCheck() {
    phase = .checking
    showWindow()
  }
  func found(_ item: SUAppcastItem, stage: SPUUserUpdateStage, reply: @escaping (SPUUserUpdateChoice) -> Void) {
    lastCheck = Date()
    let bundle = Bundle.main.bundleURL
    let writable = FileManager.default.isWritableFile(atPath: bundle.deletingLastPathComponent().path)
    guard UpdateLogic.canReplace(bundlePath: bundle.path, parentWritable: writable) else {
      reply(.dismiss)
      if userInitiated || !locationHintShown {
        locationHintShown = true
        phase = .moveToApplications
        showWindow()
      }
      return
    }
    offeredVersion = item.displayVersionString
    switch stage {
    case .downloaded:
      if installWhenFound {
        installWhenFound = false
        reply(.install)
        return
      }
      self.reply = reply
      phase = .ready(version: offeredVersion)
      showWindow()
    case .installing:
      reply(.install)
    default:
      if !userInitiated && offeredVersion == dismissedVersion {
        reply(.dismiss)
        return
      }
      self.reply = reply
      let items = offered.isEmpty ? [(version: offeredVersion, notes: item.itemDescription ?? "")] : offered
      let notes = UpdateLogic.notes(items, newerThan: installedVersion)
      phase = .available(version: offeredVersion, notes: notes.isEmpty ? "Keine Änderungsnotizen." : notes)
      showWindow()
    }
  }
  func notFound() {
    lastCheck = Date()
    if userInitiated {
      phase = .upToDate
      showWindow()
    } else {
      phase = .idle
    }
  }
  func failed(_ error: Error) {
    let loading: Bool
    switch phase {
    case .downloading, .extracting, .installing: loading = true
    default: loading = false
    }
    cancelDownload = nil
    confirmedRestart = false
    guard userInitiated || loading else {
      phase = .idle
      return
    }
    phase = .failed(
      loading
        ? "Das Update konnte nicht geladen oder bestätigt werden. Es wurde nichts verändert."
        : "Update-Server nicht erreichbar. Bitte später erneut versuchen.")
    showWindow()
  }
  func downloadStarted(cancel: @escaping () -> Void) {
    cancelDownload = cancel
    expectedBytes = 0
    receivedBytes = 0
    phase = .downloading(progress: nil)
    showWindow()
  }
  func expected(_ bytes: UInt64) {
    expectedBytes = bytes
    receivedBytes = 0
  }
  func received(_ bytes: UInt64) {
    receivedBytes += bytes
    phase = .downloading(
      progress: expectedBytes > 0 ? min(1, Double(receivedBytes) / Double(expectedBytes)) : nil)
  }
  func extracting(_ progress: Double) {
    cancelDownload = nil
    phase = .extracting(progress: progress)
  }
  func readyToInstall(_ reply: @escaping (SPUUserUpdateChoice) -> Void) {
    if Desk.shared.updateBlocked {
      self.reply = reply
      phase = .ready(version: offeredVersion)
      showWindow()
    } else {
      confirmedRestart = true
      reply(.install)
    }
  }
  func installing() { phase = .installing }
  func dismissed() {
    reply = nil
    cancelDownload = nil
    userInitiated = false
    if case .ready = phase { return }
    phase = .idle
    window?.orderOut(nil)
  }

  // MARK: Window

  func showWindow() {
    if window == nil {
      let window = NSWindow(contentViewController: NSHostingController(rootView: UpdateView(updates: self)))
      window.title = "Pi Desk aktualisieren"
      window.styleMask = [.titled, .closable]
      window.isReleasedWhenClosed = false
      window.appearance = NSAppearance(named: .darkAqua)
      window.delegate = self
      window.center()
      self.window = window
    }
    window?.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
  }
  nonisolated func windowWillClose(_ notification: Notification) {
    MainActor.assumeIsolated {
      if reply != nil { later() } else { finish() }
    }
  }

  // MARK: SPUUpdaterDelegate

  nonisolated func feedURLString(for updater: SPUUpdater) -> String? {
    guard Bundle.main.object(forInfoDictionaryKey: "PIDeskDevBuild") as? Bool == true else { return nil }
    return ProcessInfo.processInfo.environment["PI_DESK_UPDATE_FEED"]
  }
  nonisolated func updater(_ updater: SPUUpdater, didFinishLoading appcast: SUAppcast) {
    let items = appcast.items.map { (version: $0.displayVersionString, notes: $0.itemDescription ?? "") }
    MainActor.assumeIsolated { offered = items }
  }
}

/// Bridges Sparkle's user-driver callbacks, which arrive on the main thread, to AppUpdates.
final class UpdateDriver: NSObject, SPUUserDriver {
  private let model: AppUpdates
  init(model: AppUpdates) { self.model = model }
  private func main(_ body: @MainActor (AppUpdates) -> Void) { MainActor.assumeIsolated { body(model) } }

  func show(_ request: SPUUpdatePermissionRequest, reply: @escaping (SUUpdatePermissionResponse) -> Void) {
    reply(SUUpdatePermissionResponse(automaticUpdateChecks: true, sendSystemProfile: false))
  }
  func showUserInitiatedUpdateCheck(cancellation: @escaping () -> Void) { main { $0.didStartUserCheck() } }
  func showUpdateFound(
    with appcastItem: SUAppcastItem, state: SPUUserUpdateState, reply: @escaping (SPUUserUpdateChoice) -> Void
  ) { main { $0.found(appcastItem, stage: state.stage, reply: reply) } }
  func showUpdateReleaseNotes(with downloadData: SPUDownloadData) {}
  func showUpdateReleaseNotesFailedToDownloadWithError(_ error: Error) {}
  func showUpdateNotFoundWithError(_ error: Error, acknowledgement: @escaping () -> Void) {
    main { $0.notFound() }
    acknowledgement()
  }
  func showUpdaterError(_ error: Error, acknowledgement: @escaping () -> Void) {
    main { $0.failed(error) }
    acknowledgement()
  }
  func showDownloadInitiated(cancellation: @escaping () -> Void) { main { $0.downloadStarted(cancel: cancellation) } }
  func showDownloadDidReceiveExpectedContentLength(_ expectedContentLength: UInt64) {
    main { $0.expected(expectedContentLength) }
  }
  func showDownloadDidReceiveData(ofLength length: UInt64) { main { $0.received(length) } }
  func showDownloadDidStartExtractingUpdate() { main { $0.extracting(0) } }
  func showExtractionReceivedProgress(_ progress: Double) { main { $0.extracting(progress) } }
  func showReady(toInstallAndRelaunch reply: @escaping (SPUUserUpdateChoice) -> Void) {
    main { $0.readyToInstall(reply) }
  }
  func showInstallingUpdate(
    withApplicationTerminated applicationTerminated: Bool, retryTerminatingApplication: @escaping () -> Void
  ) { main { $0.installing() } }
  func showUpdateInstalledAndRelaunched(_ relaunched: Bool, acknowledgement: @escaping () -> Void) {
    acknowledgement()
  }
  func showUpdateInFocus() { main { $0.showWindow() } }
  func dismissUpdateInstallation() { main { $0.dismissed() } }
}

struct UpdateView: View {
  @ObservedObject var updates: AppUpdates
  private let tint = Color(red: 0.73, green: 0.81, blue: 0.72)

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      switch updates.phase {
      case .checking:
        ProgressView("Suche nach Updates …")
      case .upToDate:
        Text("Pi Desk \(updates.installedVersion) ist aktuell.").font(.headline)
        actions { Button("OK") { updates.close() }.keyboardShortcut(.defaultAction) }
      case .available(let version, let notes):
        Text("Pi Desk \(version) ist verfügbar").font(.system(size: 18, weight: .semibold))
        Text("Du hast \(updates.installedVersion).").foregroundStyle(.secondary)
        ScrollView {
          ChatMarkdown(
            text: notes, fontSize: 13, onOpenFile: { _ in }, onRevealFile: { _ in },
            onOpenURL: { value in
              if let url = URL(string: value), ["https", "http"].contains(url.scheme ?? "") {
                NSWorkspace.shared.open(url)
              }
            }
          ).frame(maxWidth: .infinity, alignment: .leading).padding(12)
        }.frame(minHeight: 160, maxHeight: 320)
          .background(Color.white.opacity(0.03), in: RoundedRectangle(cornerRadius: 8))
        HStack {
          Button("Diese Version überspringen") { updates.skip() }
          Spacer()
          Button("Später") { updates.later() }.keyboardShortcut(.cancelAction)
          Button("Jetzt aktualisieren") { updates.install() }.keyboardShortcut(.defaultAction)
        }
      case .downloading(let progress):
        Text("Update wird geladen …").font(.headline)
        if let progress { ProgressView(value: progress) } else { ProgressView().progressViewStyle(.linear) }
        actions { Button("Abbrechen") { updates.cancelDownloading() } }
      case .extracting(let progress):
        Text("Update wird geprüft …").font(.headline)
        ProgressView(value: progress)
      case .ready(let version):
        Text("Pi Desk \(version) ist bereit").font(.system(size: 18, weight: .semibold))
        Text("Ein Vorgang läuft noch. Das Update wird beim nächsten Beenden installiert.")
          .foregroundStyle(.secondary)
        actions {
          Button("Beim Beenden installieren") { updates.later() }
          Button("Jetzt neu starten") { updates.restartNow() }.keyboardShortcut(.defaultAction)
        }
      case .installing:
        ProgressView("Update wird installiert …")
      case .moveToApplications:
        Text("Updates benötigen den Programme-Ordner").font(.headline)
        Text("Bitte Pi Desk in den Programme-Ordner verschieben und von dort starten, um Updates zu erhalten.")
          .foregroundStyle(.secondary)
        actions { Button("OK") { updates.close() }.keyboardShortcut(.defaultAction) }
      case .failed(let message):
        Text("Update nicht möglich").font(.headline)
        Text(message).foregroundStyle(.secondary)
        actions {
          Button("Schließen") { updates.close() }
          Button("Erneut versuchen") { updates.checkNow() }.keyboardShortcut(.defaultAction)
        }
      case .idle:
        EmptyView()
      }
    }.padding(24).frame(width: 520, alignment: .leading)
      .background(Color(red: 0.105, green: 0.114, blue: 0.118)).preferredColorScheme(.dark).tint(tint)
  }

  private func actions<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
    HStack {
      Spacer()
      content()
    }
  }
}

struct UpdateSettingsView: View {
  @ObservedObject var updates: AppUpdates

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      LabeledContent("Installierte Version", value: updates.installedVersion)
      LabeledContent(
        "Letzte Prüfung",
        value: updates.lastCheck.map { $0.formatted(date: .abbreviated, time: .shortened) } ?? "Noch nicht geprüft")
      Toggle("Automatisch nach Updates suchen", isOn: $updates.automaticChecks)
      HStack {
        Button("Jetzt nach Updates suchen") { updates.checkNow() }
        if case .ready = updates.phase { Button("Jetzt neu starten") { updates.restartNow() } }
      }
      if case .moveToApplications = updates.phase {
        Label(
          "Bitte Pi Desk in den Programme-Ordner verschieben und von dort starten, um Updates zu erhalten.",
          systemImage: "exclamationmark.circle"
        ).foregroundStyle(.orange)
      }
      Text("Pi Desk sucht beim Start und danach alle 6 Stunden. Vor jeder Installation siehst du, was neu ist.")
        .font(.caption).foregroundStyle(.secondary)
    }
  }
}
```

In `native/build.py` die `sources`-Liste um `'Updates.swift'` ergänzen (nach `'UpdateLogic.swift'`).

- [ ] **Step 3: Einstellungsbereich (`native/Settings.swift`)**

In `enum SettingsSection` nach `case shortcuts = "Tastaturkürzel"` einfügen: `case updates = "Updates"`. Im `symbol`-Switch nach `case .shortcuts: "keyboard"` einfügen: `case .updates: "arrow.triangle.2.circlepath"`.

Im Body `case .agent, .appearance, .shortcuts:` ersetzen durch `case .agent, .appearance, .shortcuts, .updates:` und den inneren Switch ersetzen durch:

```swift
                switch section {
                case .agent: agentContent
                case .appearance: appearanceContent
                case .updates: UpdateSettingsView(updates: AppUpdates.shared)
                default: ShortcutSettings()
                }
```

- [ ] **Step 4: Bauen**

Run: `python3 native/build.py`
Expected: Build erfolgreich.

Meldet der Compiler, dass `UpdateDriver` nicht zu `SPUUserDriver` passt, nennen die `note:`-Zeilen die erwarteten Swift-Signaturen. Die Methodennamen werden dann genau daran angepasst, das Verhalten bleibt gleich. Die Header unter `vendor/sparkle/Sparkle.framework/Headers/SPUUserDriver.h` sind die Referenz.

- [ ] **Step 5: Dialog mit lokalem Testfeed prüfen**

Testfeed anlegen. Das Paket ist nur ein Platzhalter, installiert wird hier nicht.

```bash
mkdir -p /private/tmp/pi-desk-update-test
node -e "
import('./scripts/appcast.mjs').then(async ({appcastItem,addItem})=>{
  const fs=await import('node:fs');
  const item=appcastItem({version:'0.3.1',build:'301',entry:{version:'0.3.1',date:'12.10.2026',body:'- **Testeintrag** für den Dialog\n- Zweiter Punkt'},url:'http://127.0.0.1:8899/placeholder.dmg',length:'1',signature:'AAAA'});
  fs.writeFileSync('/private/tmp/pi-desk-update-test/appcast.xml',addItem('',item,'0.3.1'));
});"
python3 -m http.server 8899 -d /private/tmp/pi-desk-update-test
```

Den Server im Hintergrund laufen lassen (Bash `run_in_background`). Dann:

```bash
PI_DESK_UPDATE_FEED=http://127.0.0.1:8899/appcast.xml "dist/Pi Desk.app/Contents/MacOS/PiDesk"
```

Nach etwa 12 Sekunden `screencapture -x /private/tmp/pi-desk-update-test/dialog.png` ausführen und das Bild mit dem Read-Tool ansehen.
Expected: Dialog „Pi Desk 0.3.1 ist verfügbar“, „Du hast 0.3.0.“, gerenderter Changelog (fetter „Testeintrag“), Knöpfe „Diese Version überspringen“, „Später“ und „Jetzt aktualisieren“. Dunkles Quiet-Studio-Design.

Weitere Prüfungen, Ergebnis jeweils notieren:
- „Später“ schließt. ⌘, → Updates zeigt Version 0.3.0, „Letzte Prüfung“ mit Zeitstempel, Schalter an.
- App-Menü „Nach Updates suchen …“ zeigt den Dialog erneut, weil manuell.
- Lehnt Sparkle die `http`-Adresse ab (Dialog „Update nicht möglich“ direkt nach der manuellen Suche, Log in Console.app unter „Sparkle“), fällt die Prüfung mit `https` über einen lokalen Server aus. Dann direkt mit Task 8 weitermachen, der einen echten DMG nutzt, und den Befund hier notieren.

App beenden, Server stoppen.

- [ ] **Step 6: Tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add native/Updates.swift native/PiDesk.swift native/Settings.swift native/build.py
git commit -m "macOS: Update-Dialog, Einstellungsseite und Menüpunkt über Sparkle"
```

---

### Task 6: Developer-ID-Build prüfen

**Files:**
- Modify (nur bei Befund): `native/node.entitlements`, `native/build.py`

**Interfaces:**
- Consumes: `sign()` aus Task 4
- Produces: geprüfte Aussage, dass ein mit `PI_DESK_SIGN_ID` gebauter Bundle unter Hardened Runtime vollständig funktioniert

- [ ] **Step 1: Signiert bauen**

Run: `PI_DESK_SIGN_ID="Developer ID Application: LIAM SCHMID (G5FFT759WM)" python3 native/build.py`
Expected: Build erfolgreich. macOS fragt eventuell einmal nach Schlüsselbund-Zugriff für `codesign`, Liam bestätigt.

- [ ] **Step 2: Signaturen prüfen**

```bash
codesign -dvv "dist/Pi Desk.app" 2>&1 | grep -E "Authority=Developer ID Application: LIAM|flags=.*runtime|Timestamp"
codesign -dvv "dist/Pi Desk.app/Contents/Frameworks/Sparkle.framework/Versions/B/Autoupdate" 2>&1 | grep -E "Authority=Developer ID Application: LIAM|runtime"
codesign -d --entitlements - "dist/Pi Desk.app/Contents/Resources/node" 2>&1 | grep allow-jit
codesign -dvv "dist/Pi Desk.app/Contents/Resources/host/runtime/omp" 2>&1 | grep "Authority=Developer ID Application"
codesign --verify --deep --strict --verbose=2 "dist/Pi Desk.app"
plutil -extract PIDeskDevBuild raw "dist/Pi Desk.app/Contents/Info.plist"
```

Expected:
- App und Sparkle-Helfer tragen LIAM SCHMID mit `runtime` und Zeitstempel.
- `node` zeigt `allow-jit`, `omp` behält Can Boluk.
- `valid on disk` und `satisfies its Designated Requirement`.
- Die letzte Zeile endet mit einem Fehler (Schlüssel fehlt).

- [ ] **Step 3: Laufzeit unter Hardened Runtime**

```bash
"dist/Pi Desk.app/Contents/Resources/node" -e "console.log(new Function('return 6*7')())"
"dist/Pi Desk.app/Contents/Resources/host/runtime/omp" --version
open "dist/Pi Desk.app"
```

Expected: `42`, OMP meldet `18.4.10`. Die App startet und verbindet sich (Composer-Status nicht mehr „Verbindung wird hergestellt“). `pgrep -fl "Pi Desk.app/Contents/Resources/node"` findet den Hintergrundprozess. Eine vorhandene Aufgabe öffnen: OMP-Sitzung lädt.

Stürzt `node` mit `EXC_BAD_ACCESS`/`Code Signature Invalid` ab, fehlt ein Entitlement. In Console.app nach `node` suchen und `com.apple.security.cs.disable-library-validation` erst ergänzen, wenn ein konkreter Library-Validation-Fehler auftaucht. Befund notieren.

- [ ] **Step 4: Lokale Engine (Liam, optional)**

Liam lädt unter Einstellungen → Lokale Modelle ein vorhandenes GGUF-Modell. Erwartung: Die Engine startet wie im ad-hoc-Build. Ergebnis in Task 9 in `VERIFICATION.md` übernehmen. Ohne Test wird der Punkt dort als offen geführt.

- [ ] **Step 5: Commit (nur falls Dateien geändert)**

```bash
git add native/node.entitlements native/build.py
git commit -m "macOS: Hardened-Runtime-Rechte nach Signaturtest"
```

---

### Task 7: Release-Skript (Entwurf und Ausrollen)

**Files:**
- Create: `scripts/release.mjs`

**Interfaces:**
- Consumes: `section`, `bundleVersion` (Task 1), `appcastItem`, `addItem`, `parseSignature` (Task 2), `npm run sparkle` (Task 4), signierter Build (Task 6)
- Produces: `npm run release:draft`, `npm run release:publish`. Dateien `dist/Pi-Desk-X.Y.Z-apple-silicon.dmg`, `dist/SHA256SUMS-macos.txt`, Entwurfs-Release `macos-vX.Y.Z`, lokal geändertes `repo/updates/macos/appcast.xml`.

- [ ] **Step 1: Notarisierungszugang (Liam, einmalig)**

```bash
xcrun notarytool store-credentials "pi-desk-notary" --apple-id "<Liams Apple-ID>" --team-id "G5FFT759WM"
```

Liam gibt dabei ein app-spezifisches Passwort ein (appleid.apple.com → Anmeldung und Sicherheit → App-spezifische Passwörter). Danach für die Release-Shell setzen:

```bash
export PI_DESK_SIGN_ID="Developer ID Application: LIAM SCHMID (G5FFT759WM)" PI_DESK_NOTARY_PROFILE=pi-desk-notary
```

- [ ] **Step 2: `scripts/release.mjs`**

```js
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
```

- [ ] **Step 3: Syntax prüfen**

Run: `node --check scripts/release.mjs && node scripts/release.mjs; echo "exit $?"`
Expected: keine Syntaxfehler, Ausgabe `Verwendung: …`, `exit 1`

- [ ] **Step 4: Commit**

```bash
git add scripts/release.mjs
git commit -m "macOS: Release-Skript mit Notarisierung, EdDSA und Appcast"
```

Der echte Lauf von `release:draft` folgt in Task 9, nach dem Ende-zu-Ende-Test.

---

### Task 8: Ende-zu-Ende-Test 0.3.0 → 0.3.1 (lokal, ad-hoc)

**Files:**
- Keine dauerhaften Änderungen. `package.json` und `CHANGELOG.md` werden kurz auf 0.3.1 gesetzt und danach zurückgesetzt.

**Interfaces:**
- Consumes: alles aus Task 1–5, `vendor/sparkle/bin/sign_update` mit Liams Schlüssel aus Task 4

- [ ] **Step 1: Alte Version bereitstellen**

```bash
mkdir -p /private/tmp/pi-desk-e2e/feed
python3 native/build.py
rm -rf /private/tmp/pi-desk-e2e/original-0.3.0.app && ditto "dist/Pi Desk.app" /private/tmp/pi-desk-e2e/original-0.3.0.app
```

Vor jedem Prüfschritt wird die alte Version so frisch hergestellt („0.3.0 wiederherstellen“):

```bash
rm -rf "/private/tmp/pi-desk-e2e/Pi Desk.app" && ditto /private/tmp/pi-desk-e2e/original-0.3.0.app "/private/tmp/pi-desk-e2e/Pi Desk.app"
```

Wichtig: Der Updater ersetzt immer genau die laufende App. Deshalb `/private/tmp/pi-desk-e2e/Pi Desk.app` starten, nie `original-0.3.0.app`.

- [ ] **Step 2: Neue Version 0.3.1 bauen, packen, signieren, Feed schreiben**

`package.json` → `"version":"0.3.1"`. In `CHANGELOG.md` oberhalb von 0.3.0 einfügen: `## 0.3.1 – 12.10.2026\n\n- Testeintrag für den Update-Lauf\n`.

```bash
python3 native/build.py
rm -rf /private/tmp/pi-desk-e2e/stage && mkdir /private/tmp/pi-desk-e2e/stage && ditto "dist/Pi Desk.app" "/private/tmp/pi-desk-e2e/stage/Pi Desk.app"
hdiutil create -volname "Pi Desk" -srcfolder /private/tmp/pi-desk-e2e/stage -ov -format UDZO /private/tmp/pi-desk-e2e/feed/Pi-Desk-0.3.1.dmg
vendor/sparkle/bin/sign_update /private/tmp/pi-desk-e2e/feed/Pi-Desk-0.3.1.dmg
```

Die Ausgabe von `sign_update` (`sparkle:edSignature="…" length="…"`) in den folgenden Befehl einsetzen:

```bash
SIGN_OUTPUT='<Ausgabe von sign_update>' node -e "
import('./scripts/appcast.mjs').then(async ({appcastItem,addItem,parseSignature})=>{
  const {section}=await import('./scripts/changelog.mjs');const fs=await import('node:fs');
  const {signature,length}=parseSignature(process.env.SIGN_OUTPUT);
  const entry=section(fs.readFileSync('CHANGELOG.md','utf8'),'0.3.1');
  fs.writeFileSync('/private/tmp/pi-desk-e2e/feed/appcast.xml',addItem('',appcastItem({version:'0.3.1',build:'301',entry,url:'http://127.0.0.1:8899/Pi-Desk-0.3.1.dmg',length,signature}),'0.3.1'));
});"
python3 -m http.server 8899 -d /private/tmp/pi-desk-e2e/feed
```

Server im Hintergrund lassen.

- [ ] **Step 3: Update durchführen**

0.3.0 wiederherstellen (siehe Step 1), dann:

```bash
PI_DESK_UPDATE_FEED=http://127.0.0.1:8899/appcast.xml "/private/tmp/pi-desk-e2e/Pi Desk.app/Contents/MacOS/PiDesk"
```

Nach ca. 12 s Screenshot (`screencapture -x /private/tmp/pi-desk-e2e/1-offer.png`) und ansehen: Dialog 0.3.1 mit „Testeintrag für den Update-Lauf“. „Jetzt aktualisieren“ klicken. Liam klickt oder der Agent per Computer-Use; ohne Klickmöglichkeit Liam bitten. Erwartung: Fortschritt, App beendet sich und startet neu.

Run: `plutil -extract CFBundleShortVersionString raw "/private/tmp/pi-desk-e2e/Pi Desk.app/Contents/Info.plist"`
Expected: `0.3.1`

Lehnt Sparkle das Update wegen unterschiedlicher ad-hoc-Signaturen ab (Console.app, Prozess `Autoupdate`/`PiDesk`, Meldung zu Code Signing), Step 1 und 2 mit `PI_DESK_SIGN_ID="Developer ID Application: LIAM SCHMID (G5FFT759WM)" PI_DESK_TEST_FEED_BUILD=1 python3 native/build.py` wiederholen. Diese Builds nehmen den Testfeed an, `release.mjs` verweigert sie. Befund notieren.

- [ ] **Step 4: Busy-Sperre**

0.3.0 wiederherstellen (siehe Step 1). App mit Testfeed starten wie in Step 3. Vor dem Klick auf „Jetzt aktualisieren“ unter „Anbieter verbinden“ eine Anmeldung starten und offen lassen (`loginBusy`). Dann aktualisieren.
Expected: Nach dem Download erscheint „Pi Desk 0.3.1 ist bereit – Ein Vorgang läuft noch …“, kein Neustart. „Jetzt neu starten“ zeigt die Abfrage „Pi Desk beenden?“. „Weiterarbeiten“ bricht ab, „Beenden“ installiert und startet neu, ohne zweite Abfrage.

- [ ] **Step 5: Manipuliertes Paket**

0.3.0 wiederherstellen (siehe Step 1). Den Original-DMG sichern: `cp /private/tmp/pi-desk-e2e/feed/Pi-Desk-0.3.1.dmg /private/tmp/pi-desk-e2e/good.dmg`. Dann `printf 'x' >> /private/tmp/pi-desk-e2e/feed/Pi-Desk-0.3.1.dmg` (Länge und Signatur passen nicht mehr), App mit Testfeed starten, „Jetzt aktualisieren“.
Expected: „Das Update konnte nicht geladen oder bestätigt werden. Es wurde nichts verändert.“. Die Version bleibt `0.3.0`.

- [ ] **Step 6: Start aus dem Disk-Image**

Intakten DMG zurückholen: `cp /private/tmp/pi-desk-e2e/good.dmg /private/tmp/pi-desk-e2e/feed/Pi-Desk-0.3.1.dmg`. Im Disk-Image liegt 0.3.1. Damit Sparkle etwas findet, den Feed mit dem Befehl aus Step 2 neu schreiben, dabei `version:'0.3.2',build:'302'` und `section(…,'0.3.2')` verwenden. Der Abschnitt `0.3.2` muss dafür kurz in `CHANGELOG.md` stehen, z. B. `## 0.3.2` mit `- Ortstest`.

```bash
hdiutil attach /private/tmp/pi-desk-e2e/feed/Pi-Desk-0.3.1.dmg -nobrowse -readonly
PI_DESK_UPDATE_FEED=http://127.0.0.1:8899/appcast.xml "/Volumes/Pi Desk/Pi Desk.app/Contents/MacOS/PiDesk"
```

App-Menü → „Nach Updates suchen …“.
Expected: Hinweis „Updates benötigen den Programme-Ordner“, kein Download. App beenden, `hdiutil detach "/Volumes/Pi Desk"`.

- [ ] **Step 7: Aufräumen**

`package.json` → `"version":"0.3.0"`, die Testabschnitte 0.3.1/0.3.2 aus `CHANGELOG.md` entfernen, `git diff --stat` darf für beide Dateien nichts mehr zeigen. Server stoppen. `python3 native/build.py`, damit `dist` wieder 0.3.0 enthält. Ergebnisse aller Schritte für Task 9 notieren (bestanden/abweichend, Screenshots).

---

### Task 9: Doku, Entwurfs-Release, Ausrollen

**Files:**
- Modify: `README.md`, `VERIFICATION.md`, `CHANGELOG.md` (Datum), `repo/README.md`

- [ ] **Step 1: `README.md` (macOS)**

- Im ersten Abschnitt „Native macOS-App“: DMG-Name `Pi-Desk-0.3.0-apple-silicon.dmg`. Den Satz zur ad-hoc-Signatur ersetzen durch: „Releases sind mit Developer ID signiert und von Apple notarisiert. Lokale Builds ohne `PI_DESK_SIGN_ID` bleiben ad-hoc signiert.“
- „Neu bauen“: vor `python3 native/build.py` die Zeile `npm run sparkle` ergänzen. Den Satz ergänzen: „`npm run sparkle` lädt Sparkle 2.10.0 SHA-256-geprüft nach `vendor/`.“
- Neuer Abschnitt nach „Funktionsumfang“:

```markdown
## Updates

Pi Desk sucht 10 Sekunden nach dem Start und danach alle 6 Stunden nach einer neuen Version (Sparkle 2.10.0). Gibt es eine, erscheint der Changelog mit **Jetzt aktualisieren**, **Später** und **Diese Version überspringen**. Während ein Agent arbeitet oder eine Anmeldung läuft, wird nur geladen und beim nächsten Beenden installiert. **Einstellungen → Updates** schaltet die automatische Suche ab oder prüft sofort; ebenso **Pi Desk → Nach Updates suchen …**. Updates benötigen eine App im Programme-Ordner (oder einem anderen beschreibbaren Ordner), nicht im Disk-Image.

Quelle ist `updates/macos/appcast.xml` in diesem Repository; das DMG selbst ist ein Anhang am GitHub-Release. Sparkle prüft jede Datei mit dem eingebauten EdDSA-Schlüssel (`native/sparkle-public-key.txt`), bevor es sie installiert.

## Release veröffentlichen

Einmalig: Sparkle-Schlüssel (`vendor/sparkle/bin/generate_keys`, privat im Schlüsselbund und Passwortmanager) und Notarisierungsprofil (`xcrun notarytool store-credentials pi-desk-notary …`).

1. Version in `package.json` erhöhen, Abschnitt in `CHANGELOG.md` schreiben.
2. `PI_DESK_SIGN_ID="Developer ID Application: …" PI_DESK_NOTARY_PROFILE=pi-desk-notary npm run release:draft`: Build, Notarisierung, DMG, EdDSA-Signatur, Entwurfs-Release `macos-vX.Y.Z`, lokale Änderung an `updates/macos/appcast.xml`.
3. Entwurf herunterladen und testen.
4. `npm run release:publish` veröffentlicht nach Rückfrage das Release und pusht den Feed.

Zurückrollen: Feed-Commit zurücksetzen. Bereits aktualisierte Installationen bleiben auf der Version.
```

- Abschnitt „GitHub-Download“: auf 0.3.0 umstellen, „Developer-ID-signiert und notarisiert, ab dieser Version mit automatischen Updates; einmalig manuell installieren“.

- [ ] **Step 2: `VERIFICATION.md`**

Abschnitt „0.3.0 – Updates“: Testanzahl aus `npm test`, Ergebnisse aus Task 5 (Dialog-Screenshot), Task 6 (Signatur, `node`/`omp` unter Hardened Runtime, ggf. lokale Engine) und Task 8 (jeder Schritt bestanden/abweichend). Notarisierungs-Ergebnis und `spctl`-Ausgabe aus Step 4 ergänzen. Ungeprüftes als offen markieren: Update über den echten GitHub-Feed (erst mit 0.3.1 möglich).

- [ ] **Step 3: Haupt-README (`repo/README.md`)**

Download-Zeile macOS: `- [macOS 0.3.0 – DMG für Apple Silicon](https://github.com/LiLoLama/pi-desk/releases/tag/macos-v0.3.0)` mit dem Zusatz „notarisiert, ab dieser Version mit automatischen Updates; einmalig manuell installieren“. Den Satz „macOS ist ad-hoc signiert und nicht notarisiert“ entfernen. Falls noch nicht durch den Windows-Plan geschehen, unter „Builds und Releases“ ergänzen: „Update-Feeds liegen unter `updates/` und werden erst beim Ausrollen committet. Ablauf je Plattform im jeweiligen App-README.“

- [ ] **Step 4: Entwurfs-Release bauen (nur mit Liams Freigabe)**

Datum in `CHANGELOG.md` (`## 0.3.0 – …`) auf heute setzen. Dann in Liams Shell mit gesetzten Variablen aus Task 7:

```bash
npm run release:draft
```

Expected: zwei erfolgreiche Notarisierungen (`status: Accepted`), `spctl` meldet `accepted` und `source=Notarized Developer ID` für App und DMG. Entwurf `macos-v0.3.0` mit DMG und `SHA256SUMS-macos.txt`, `git status` zeigt `updates/macos/appcast.xml` als neu.

Entwurfs-DMG laden (`gh release download macos-v0.3.0 --repo LiLoLama/pi-desk --pattern '*.dmg' --dir /private/tmp/pi-desk-draft`), öffnen, App nach `/Applications` ziehen, starten: keine Gatekeeper-Warnung, Einstellungen → Updates zeigt 0.3.0.

- [ ] **Step 5: Abschlussprüfung**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add README.md VERIFICATION.md CHANGELOG.md ../../README.md
git commit -m "macOS: Doku für notarisierte Releases und automatische Updates"
git push
```

- [ ] **Step 7: Ausrollen (nur auf Liams ausdrücklichen Auftrag)**

```bash
npm run release:publish
```

Expected: Rückfrage, nach „ja“ ist das Release öffentlich, `updates/macos/appcast.xml` gepusht. Prüfen: `curl -s https://raw.githubusercontent.com/LiLoLama/pi-desk/main/updates/macos/appcast.xml | grep shortVersionString` zeigt `0.3.0` (eventuell erst nach ca. 5 Minuten).
