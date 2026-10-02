# Windows-Port 0.3.0 – Prüfstand 02.10.2026

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

Ein tatsächlicher Windows-Lauf bleibt zwingend separat: Start der x64-EXE, native Dialoge, OAuth, Bildinferenz, CPU-/Vulkan-Modellinferenz, GPU-Treiberverträglichkeit und Prozessbereinigung sind auf einem Windows-Rechner noch nicht nachgewiesen. Details stehen in [WINDOWS-TESTPLAN.md](WINDOWS-TESTPLAN.md). Die App ist nicht signiert und besitzt keinen automatischen Updater.

## Paketierung

Electron 44.4.5, electron-builder 26.15.3, OMP 18.4.10. Das Paket enthält `Pi Desk.exe`, Electron/Node, `resources/app.asar`, `resources/runtime/omp.exe`, Lizenzen, Startanleitung, README und Windows-Testliste. Keine Nutzerprofile oder Zugangsdaten wurden übernommen.

- Datei: `dist/Pi-Desk-0.3.0-Windows-x64.zip`
- Größe: 269.411.471 Bytes
- SHA-256: `4b783165374e45abb2a068ee48753d614be730298e787775e8fd60a59871bb7d`
- ZIP-CRC vollständig geprüft
- `Pi Desk.exe` und `resources/runtime/omp.exe`: PE32+ x86-64 bestätigt
- OMP-Runtime im Paket bytegenau gegen die offizielle Prüfsumme geprüft

Kein Setup.exe: `npm run build:installer` bleibt für einen echten Windows-Build vorbereitet. Windows ARM64 wurde nicht gebaut.
