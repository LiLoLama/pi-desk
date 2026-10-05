# Automatische Updates mit Changelog – Design

Stand: 05.10.2026 · Status: abgestimmt, noch nicht umgesetzt

## Ziel

Wer Pi Desk installiert hat, erfährt von neuen Versionen ohne Hinweis von außen. Die App prüft selbst, zeigt den Changelog und aktualisiert sich nach einem Klick. Das Veröffentlichen eines Updates besteht für den Herausgeber aus einem bewussten Ausroll-Schritt.

Ein echter Push ist ohne eigenen Server nicht möglich. Die Apps fragen deshalb regelmäßig eine feste Feed-Adresse ab.

## Entscheidungen

| Thema | Entscheidung |
|---|---|
| Windows-Paket | NSIS-Setup (pro Benutzer) mit `electron-updater`. Neue Releases ohne ZIP. |
| Mac-Updater | Sparkle 2 mit eigenem SwiftUI-Dialog (Quiet Studio). |
| Mac-Signatur | Developer ID mit Hardened Runtime und Notarisierung. Ohne Signier-ID weiter ad-hoc für Entwicklungs-Builds. |
| Changelog-Quelle | `apps/macos/CHANGELOG.md` und `apps/windows/CHANGELOG.md` |
| Feed-Ort | Dateien im Repo unter `updates/macos/appcast.xml` und `updates/windows/latest.yml`, ausgeliefert über `raw.githubusercontent.com`. Pakete bleiben Anhänge an GitHub-Releases. |

Mac- und Windows-Releases liegen im selben Repo. GitHubs „neuestes Release“ ist deshalb nicht plattformeindeutig. Jede Plattform bekommt eine eigene, feste Feed-Datei. Der Push des Feed-Commits ist der Moment, in dem ein Update live geht.

## 1. Verhalten für Nutzer (beide Plattformen)

**Prüfen**
- 10 Sekunden nach App-Start, danach alle 6 Stunden, solange die App läuft.
- Automatische Prüfungen sind still. Ohne Update oder ohne Internet erscheint nichts.

**Update verfügbar**
- Dialog: „Pi Desk X ist verfügbar (du hast Y)“ und darunter der Changelog als Markdown. Sind mehrere Versionen dazwischen, werden alle Abschnitte neuer als Y gezeigt, neueste oben.
- Knöpfe: **Jetzt aktualisieren** · **Später** · **Diese Version überspringen**.
- „Später“ fragt beim nächsten App-Start erneut. „Überspringen“ meldet sich erst bei einer höheren Version wieder.

**Aktualisieren**
- Download mit Fortschritt, anschließend Neustart in die neue Version. „Später“ und „Überspringen“ unterdrücken nur die automatischen Prüfungen; „Jetzt nach Updates suchen“ zeigt die Version trotzdem.
- Läuft ein Agent, ist eine Anmeldung aktiv oder wartet eine Genehmigung, wird nur heruntergeladen. Statt des Neustarts erscheint „Update bereit, wird beim nächsten Beenden installiert“ mit „Jetzt neu starten“. Dieser Knopf geht durch den bestehenden Beenden-Dialog mit seiner Warnung vor laufenden Vorgängen.
- Chats, Anmeldungen, Einstellungen und Modelle liegen außerhalb des App-Pakets und bleiben unberührt.

**Einstellungen**
- Neuer Bereich „Updates“: installierte Version, Schalter „Automatisch nach Updates suchen“ (Standard: an), Knopf „Jetzt nach Updates suchen“, Zeitpunkt der letzten Prüfung.
- Mac zusätzlich: Menüpunkt „Nach Updates suchen…“ im App-Menü.

**Nicht enthalten:** Zwangs-Updates, Beta-Kanal, stilles Installieren ohne Rückfrage, Downgrades.

## 2. macOS

**Sparkle einbinden**
- Sparkle 2 als gepinnte Release-Version, SHA-256-geprüft, nach `apps/macos/vendor/` geladen (von Git ausgeschlossen). Lizenz nach `apps/macos/licenses/`.
- `native/build.py` linkt das Framework (`-F vendor`, `-framework Sparkle`, rpath `@executable_path/../Frameworks`) und kopiert es nach `Contents/Frameworks`.
- `Info.plist`: `SUFeedURL` (raw-Adresse von `updates/macos/appcast.xml`), `SUPublicEDKey`, `SUEnableAutomaticChecks = true`, `SUScheduledCheckInterval = 21600`, `SUAutomaticallyUpdate = false`.

**Neues Modul `native/Updates.swift`**
- Eigene Implementierung von `SPUUserDriver` in SwiftUI für die Dialoge aus Abschnitt 1.
- Changelog: Die `description` jedes Appcast-Eintrags enthält den Markdown-Abschnitt dieser Version. Der Dialog sammelt über den Updater-Delegate alle geladenen Einträge mit Version > installiert und rendert sie mit dem vorhandenen nativen Markdown-Renderer (`Markdown.swift`).
- Der Updater-Delegate hält den Neustart zurück, solange die App beschäftigt ist (siehe Abschnitt 1). Er nutzt denselben Zustand wie der bestehende Beenden-Dialog.
- Läuft die App aus einem schreibgeschützten oder übersetzten Ort (DMG, App Translocation), erscheint der Hinweis „Bitte Pi Desk in den Programme-Ordner verschieben, um Updates zu erhalten“.
- `Settings.swift`: neuer Fall `.updates` mit eigener Ansicht. Im App-Menü kommt „Nach Updates suchen…“ dazu.
- Test-Override: Eine Feed-Adresse aus der Umgebungsvariable `PI_DESK_UPDATE_FEED` wird nur in ad-hoc-signierten Builds angenommen. In Developer-ID-signierten Builds wird sie ignoriert.

**Version**
- `apps/macos/package.json` erhält ein Feld `version` als einzige Quelle. `build.py` liest es für `CFBundleShortVersionString` und berechnet `CFBundleVersion = major*10000 + minor*100 + patch` (0.3.0 → 300).

**Signierung und Notarisierung (`build.py`)**
- Ist `PI_DESK_SIGN_ID` gesetzt, wird mit Hardened Runtime und Zeitstempel signiert, von innen nach außen: Sparkle-XPC-Dienste und Hilfsprogramme, `Autoupdate`, `Updater.app`, das Framework, `node`, `omp`, dann die App.
- Entitlements-Datei für `node`/`omp` mit `com.apple.security.cs.allow-jit` und `com.apple.security.cs.allow-unsigned-executable-memory`. Benötigte Rechte für die nachgeladenen llama.cpp-/MLX-Engines werden beim Test ermittelt.
- DMG-Erstellung und Notarisierung übernimmt `scripts/release.mjs draft`: App notarisieren und stempeln, DMG bauen, signieren, notarisieren und stempeln (`xcrun notarytool submit --keychain-profile "$PI_DESK_NOTARY_PROFILE" --wait`, `xcrun stapler staple`).
- Ohne `PI_DESK_SIGN_ID` gilt das heutige Verhalten (ad-hoc). `build.py` setzt dann zusätzlich `PIDeskDevBuild = true` in `Info.plist`.
- Zugangsdaten bleiben im Schlüsselbund bzw. in Umgebungsvariablen und kommen nie ins Repo.

**Update-Paket und Schlüssel**
- Das notarisierte DMG ist Erst-Download und Update-Paket zugleich.
- EdDSA-Signatur jedes DMG mit Sparkles `sign_update`. Der private Schlüssel liegt im Schlüsselbund des Herausgebers und muss zusätzlich gesichert werden. Ohne ihn können bestehende Installationen keine Updates mehr annehmen.
- Kein Signaturwechsel-Problem: 0.2.0 hat keinen Updater. Die erste Sparkle-Version (0.3.0) ist bereits Developer-ID-signiert.

## 3. Windows

**Paket**
- `electron-builder --win nsis --x64` mit vorhandener NSIS-Konfiguration (`perMachine: false`). Installation nach `%LOCALAPPDATA%\Programs\Pi Desk` ohne Admin-Rechte.
- Ergebnis: `Pi-Desk-x.y.z-Windows-x64-Setup.exe` und `latest.yml`. Differenzielle Updates (`.blockmap`) sind abgeschaltet, weil die Release-URLs je Version verschiedene Pfade haben. Updates laden das ganze Setup.
- Das Profil bleibt `%LOCALAPPDATA%\Pi Desk\desktop` bzw. `\engine` (`app.setPath('userData', …)`). Bisherige ZIP-Nutzer behalten ihre Daten.
- `README.md` und `build/START.txt` werden auf das Setup umgestellt. Neue Releases enthalten kein ZIP.

**Updater**
- Neue gepinnte Abhängigkeit `electron-updater` im Lockfile.
- Neues Modul `desktop/updates.cjs` im Hauptprozess: Generic-Provider mit der raw-Adresse von `updates/windows/`, `autoDownload = false`, `autoInstallOnAppQuit = true` nach abgeschlossenem Download. Prüfintervall wie Abschnitt 1. Einstellungen (Auto-Prüfung an/aus, übersprungene Version, letzte Prüfung) liegen im Desktop-Profil.
- `latest.yml` verweist mit absoluter URL auf den Setup-Anhang im GitHub-Release. `electron-updater` prüft SHA-512.
- Changelog: `releaseNotes` in `latest.yml` enthält die Abschnitte der letzten 10 Versionen mit Versionsüberschriften. Die Oberfläche zeigt nur Abschnitte neuer als die installierte Version und rendert sie mit `marked` + `DOMPurify`.
- Busy-Sperre: Vor `quitAndInstall` gilt dieselbe Prüfung wie in `requestClose()` (`state.authBusy || state.tasks.some(t => t.busy)`).
- IPC: neue Handler (`pi:update-state`, `pi:update-check`, `pi:update-download`, `pi:update-install`, `pi:update-skip`, `pi:update-later`, `pi:update-auto`) laufen über `trusted(event)`. Statusereignisse an die Oberfläche enthalten nur Version, Changelog, Fortschritt und Fehlertext, keine Adressen oder Pfade. `preload.cjs` gibt nur diese Funktionen frei.
- Oberfläche (`public/`): Update-Dialog und Einstellungsbereich „Updates“ in Quiet Studio.
- Test-Override `PI_DESK_UPDATE_FEED` gilt nur, wenn die App nicht gepackt läuft (`!app.isPackaged`).

**Build in GitHub Actions**
- `.github/workflows/windows-release.yml`, nur `workflow_dispatch`, Runner `windows-latest`: `npm ci`, `npm run runtime:win`, `npm test`, NSIS-Build, Upload von Setup, `latest.yml` und Prüfsummen als **Entwurfs-Release** `windows-vX.Y.Z`. Der Release-Text kommt aus dem Changelog-Abschnitt.
- Die Testsuite läuft damit auf echtem Windows. Ein GUI-Test auf einem Windows-PC wird dadurch nicht ersetzt.

**Bekannte Grenze**
- Setup und Updates sind unsigniert. Beim Erst-Download kommt die SmartScreen-Warnung. Die Echtheit eines Updates hängt allein an der SHA-512-Prüfsumme aus dem Feed und damit an der Sicherheit des GitHub-Kontos. Windows-Code-Signing (z. B. Azure Trusted Signing) ist nicht Teil dieses Umfangs. Die Build-Konfiguration bleibt dafür nachrüstbar.

## 4. Veröffentlichen

**Changelog-Format** (beide Apps)

```markdown
## 0.4.0 – 12.10.2026

- Stichpunkt für Nutzer
```

Die Skripte brechen ab, wenn zur Version in `package.json` kein Abschnitt existiert.

**Ablauf**
1. **Vorbereiten:** Version in `package.json` erhöhen, Changelog-Abschnitt schreiben.
2. **Entwurf:**
   - Mac: `npm run release:draft` in `apps/macos` baut, signiert und notarisiert, signiert per EdDSA und legt das Entwurfs-Release `macos-vX.Y.Z` mit DMG, `SHA256SUMS-macos.txt` und Changelog an. `updates/macos/appcast.xml` wird lokal um den neuen Eintrag ergänzt, nicht committet.
   - Windows: Workflow starten, danach `npm run release:feed` in `apps/windows`. Es liest die `latest.yml` aus dem Entwurfs-Release, setzt die absolute URL und den gesammelten Changelog ein und schreibt `updates/windows/latest.yml` lokal.
   - Bis hierhin sieht kein Nutzer etwas. Der Entwurf kann heruntergeladen und getestet werden.
3. **Ausrollen:** `npm run release:publish` in der jeweiligen App zeigt Version, Anhänge und Feed-Diff und fragt nach. Danach veröffentlicht es das Release (`gh release edit --draft=false`), committet die Feed-Datei und pusht. Nach den Arbeitsregeln wird dieser Schritt nur auf ausdrücklichen Auftrag ausgeführt.

**Zurückrollen:** Revert des Feed-Commits. Bereits aktualisierte Installationen bleiben auf der Version. Korrekturen kommen als neue, höhere Version.

**Übergangsversionen:** Mac 0.3.0 und Windows 0.4.0 sind die ersten Versionen mit Updater. Ihr Release-Text sagt: „Einmalig manuell installieren, danach automatische Updates.“ Die Download-Links im Haupt-README werden aktualisiert.

## 5. Fehlerfälle

| Fall | Verhalten |
|---|---|
| Kein Internet, Feed nicht erreichbar oder ungültig | Automatische Prüfung still. Manuelle Prüfung zeigt einen verständlichen Hinweis. |
| Download abgebrochen | Hinweis mit „Erneut versuchen“, alte Version unverändert |
| Prüfsumme oder Signatur falsch | „Update konnte nicht bestätigt werden, es wurde nichts verändert.“ Das Paket wird verworfen. |
| Mac: App in schreibgeschütztem Ort | Hinweis auf den Programme-Ordner, kein Download |
| Windows: Installation schlägt fehl | NSIS lässt die alte Version stehen. Protokoll unter `%LOCALAPPDATA%\Pi Desk\desktop\logs`. |
| App beschäftigt | Nur herunterladen, Installation beim Beenden (Abschnitt 1) |

## 6. Tests

**Automatisch**
- Beide Apps: Versionsvergleich, Changelog-Parser (Abschnitt finden, Abschnitte neuer als Version X filtern, fehlender Abschnitt bricht ab), Feed-Erzeugung (`appcast.xml`, `latest.yml` mit absoluter URL und gesammelten Notizen).
- Windows: `updates.cjs` mit nachgebildetem `autoUpdater`: Ablauf, Überspringen, Busy-Sperre, IPC-Prüfung über `trusted`.
- Mac: Busy-Sperre und Versionsberechnung in `build.py`.

**Mac Ende-zu-Ende (lokal)**
- Zwei ad-hoc-Builds (z. B. 0.3.0 → 0.3.1) mit lokalem Feed über `PI_DESK_UPDATE_FEED`: Update kommt an, Changelog stimmt, Neustart wird bei laufendem Agenten zurückgehalten, manipuliertes DMG wird abgewiesen, App aus dem DMG zeigt den Hinweis.
- Signierter Build: Start von App, `node`, `omp` und lokaler Engine unter Hardened Runtime. `spctl --assess` und `stapler validate` für App und DMG.

**Windows**
- Testsuite im Actions-Workflow auf Windows.
- Der echte Update-Lauf (Setup installieren, Update annehmen, Neustart, Daten erhalten, Busy-Sperre) kommt als eigener Abschnitt in `WINDOWS-TESTPLAN.md` und bleibt in `VERIFICATION.md` als offen markiert, bis er auf einem Windows-PC bestätigt ist.

## Dateien

Neu:
- `updates/macos/appcast.xml`, `updates/windows/latest.yml`
- `apps/macos/CHANGELOG.md`, `apps/windows/CHANGELOG.md`
- `apps/macos/native/Updates.swift`, Entitlements-Datei, Release-Skripte
- `apps/windows/desktop/updates.cjs`, Release-Skripte, `.github/workflows/windows-release.yml`

Geändert:
- `apps/macos/native/build.py`, `Settings.swift`, `PiDesk.swift` (Menü, Busy-Zustand), `package.json`
- `apps/windows/desktop/main.cjs`, `preload.cjs`, `public/*`, `package.json`, Lockfile
- `.gitignore` (`apps/macos/vendor/`)
- READMEs, `VERIFICATION.md`, `WINDOWS-TESTPLAN.md`, Lizenzordner
