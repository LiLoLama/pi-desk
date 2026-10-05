# Windows-Port 0.4.0 – Prüfstand 05.10.2026

Die Abschnitte zu OMP 18.4.10 und zur Paketierung stammen vom Stand 0.3.0 (02.10.2026) und wurden für 0.4.0 nicht neu erhoben.

## 0.4.0 – Updates

Setup (NSIS, pro Benutzer, unsigniert, keine Differenzupdates) und automatische Updates über electron-updater 6.8.9 mit generischem Feed `updates/windows/latest.yml`. Alle folgenden Läufe fanden auf macOS statt.

### Auf macOS nachgewiesen

- `npm test`: 54 von 54 Tests bestanden, davon 26 in `test/updates.test.mjs` (Updater-Konfiguration, Prüfzyklus, Überspringen, Später, Download und Installation, Fehlerfälle, Dateispeicher), 7 in `test/release.test.mjs` (Feed-Erzeugung und Prüfung vor dem Veröffentlichen) und 6 in `test/changelog.test.mjs` (Parsen und Filtern der Changelog-Abschnitte). Die Unit-Tests simulieren electron-updater; sie wurden plattformneutral geschrieben, liefen bisher aber nur auf macOS.
- `npm run test:desktop` (mit der Mac-OMP-Runtime): Electron-Smoke bestanden. Er prüft die Update-Schnittstelle `window.piDesktop.updates` (ohne Feed-URL im Renderer), die Einstellungsseite „Updates“, den Update-Dialog (verfügbar, bereit, aktuell), dass der Einstellungsdialog bei einem Statuswechsel nicht wieder aufgeht, dass der Dialog während des Ladens versteckt bleibt und bei „bereit“ erscheint, sowie das Bereinigen von HTML und Links in den Release-Notizen. Der Smoke bedient nur die Oberfläche mit simulierten Statuswerten, nicht den echten Updater. `verification/update.png` wird beim Smoke erzeugt und nicht eingecheckt (in `.gitignore`).
- Die Release-Skripte sind nur über ihre Unit-Tests abgedeckt. Workflow und `gh`-Aufrufe wurden nicht ausgeführt.

### Offen

- Lauf des Workflows **Windows-Release** auf `windows-latest`: `npm test` unter Windows, NSIS-Build, Entwurfs-Release mit Setup, `latest.yml` und `SHA256SUMS-windows.txt`. Der Workflow ist erst startbar, wenn die Datei auf `main` liegt. Eine Run-URL oder ein Windows-Testergebnis liegt noch nicht vor.
- Echter electron-updater-Lauf (Feed, Download, SHA-512, Installation); bisher nur simuliert beziehungsweise Oberfläche geprüft.
- Echte Installation des Setups auf Windows (Installationsart „Nur für mich“ ohne Administratorrechte, Startmenü, Desktopverknüpfung, Übernahme der Daten aus der ZIP-Version).
- Update-Lauf 0.4.0 → 0.4.1 über Feed und Release-Anhang, inklusive SHA-512-Prüfung und Neustart ohne UAC-Abfrage.
- SmartScreen-Verhalten beim unsignierten Setup und beim automatisch geladenen Update.
- Busy-Regel auf Windows: Mit laufendem Agenten oder Anmeldung nur laden und beim nächsten Beenden installieren.
- Dass `gh` den Entwurf über den Tag `windows-vX.Y.Z` findet (`release:publish`).
- Alle Punkte aus [WINDOWS-TESTPLAN.md](WINDOWS-TESTPLAN.md) → „Updates (ab 0.4.0)“.

## OMP-18.4.10-Migration

- Offizielle Windows-x64-Runtime auf OMP 18.4.10 aktualisiert. SHA-256 der eingebundenen und verpackten `omp.exe`: `7232c209641f0cad7e20bdb3a074cdb2fb31ae2aa73d42c491c705d28e0d3895`.
- Aktuelle OMP-Drittanbieterhinweise übernommen; Hauptlizenz blieb unverändert.
- Das entfernte `hub` wurde durch `wait` ersetzt. `find` gehört zum 18.4-Katalog, ist ohne passendes Judge-/Search-Modell aber nicht in jeder Sitzung verfügbar und wird daher nicht im festen `--tools`-Katalog erzwungen.
- RPC-18.4-Verträge angebunden: stabile `messageId`, Queue-Snapshots/-Events, strukturierte Promptfehler sowie `session_settled`. Deferred MCP-Routen werden in altem und neuem Systemprompt-Format erkannt.

## Erfolgreich auf macOS mit echter OMP-18.4.10-Mac-Runtime

Alle Läufe verwendeten isolierte temporäre Profile, lokale Modellfixtures und keine persönlichen Anbieter-Zugangsdaten.

- 15/15 fokussierte Node-Tests: RPC-Chunks, Dateigrenzen/Symlinks, Settings/Secrets, Skills/MCP, Modellscan, Windows-Pfade/Runtime, persistente Genehmigungen, Worktree-Schutz sowie neue RPC-18.4-Vertragstests.
- Runtime-Smoke: Schreiben ablehnen/erlauben, Sitzung fortsetzen und Streaming abschließen.
- HTTP-Smoke: Zugriffsschutz, Projekt/Kontext/Anbieter, Policy-Neustart, Wiederanlauf sowie Archiv/Papierkorb.
- Settings- und Capabilities-Smokes: lokale Anbieter, Skills, MCP-Probe, deferred Tool-Erkennung, Genehmigung und Persistenz.
- Paritätslauf: Chat-Freigabe nach Backend-Neustart, entfernte Warteschlangennachricht erreicht das Modell nicht, Verzweigung, HTML-Export und Import; Handoff-Ablehnung einer kurzen Sitzung korrekt sichtbar.
- Electron-Smoke: echte isolierte Desktop-Oberfläche, Einstellungen, nativer Auswahl-Bridge, Projekt mit Umlauten/Leerzeichen, OMP-Sitzung und Dateivorschau.
- Electron-Parität: zehn Einstellungsbereiche, Skills, Plugins/Hooks, MCP, Projektregeln, Worktree, Darstellung/Kürzel, Modellscan, Todos, Bilder, Markdown und Papierkorb. Die bekannte macOS-Sandbox-Diagnose trat auf, ohne die geprüften Abläufe zu blockieren; sie ist keine Windows-Beobachtung.
- Native-Host-Test: zufälliger Port, Token-Schutz, einzelne Engine, EOF-Shutdown und Lock-Bereinigung.

## Auf Windows offen

Ein tatsächlicher Windows-Lauf bleibt zwingend separat: Start der x64-EXE, native Dialoge, OAuth, Bildinferenz, CPU-/Vulkan-Modellinferenz, GPU-Treiberverträglichkeit und Prozessbereinigung sind auf einem Windows-Rechner noch nicht nachgewiesen. Details stehen in [WINDOWS-TESTPLAN.md](WINDOWS-TESTPLAN.md). Die App ist nicht signiert; der automatische Updater ist auf Windows noch nicht ausgeführt worden (siehe „0.4.0 – Updates“).

## Paketierung (Stand 0.3.0, ZIP)

Electron 44.4.5, electron-builder 26.15.3, OMP 18.4.10. Das Paket enthält `Pi Desk.exe`, Electron/Node, `resources/app.asar`, `resources/runtime/omp.exe`, Lizenzen, Startanleitung, README und Windows-Testliste. Keine Nutzerprofile oder Zugangsdaten wurden übernommen.

- Datei: `dist/Pi-Desk-0.3.0-Windows-x64.zip`
- Größe: 269.411.471 Bytes
- SHA-256: `4b783165374e45abb2a068ee48753d614be730298e787775e8fd60a59871bb7d`
- ZIP-CRC vollständig geprüft
- `Pi Desk.exe` und `resources/runtime/omp.exe`: PE32+ x86-64 bestätigt
- OMP-Runtime im Paket bytegenau gegen die offizielle Prüfsumme geprüft

Stand 0.3.0: Kein Setup.exe; der damalige Skriptname `build:installer` existiert nicht mehr, ab 0.4.0 erzeugt `npm run build:win` das Setup. Windows ARM64 wurde nicht gebaut.
