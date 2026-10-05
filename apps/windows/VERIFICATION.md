# Windows-Port 0.3.1 – Prüfstand 05.10.2026

## Kontextlänge lokaler Modelle · 05.10.2026

Anlass: Rückmeldung aus der Community unter Windows. Ministral 3 3B (GGUF, CPU) scheiterte mit Fehler 400, weil die Engine fest mit 8.192 Tokens Kontext startete und der Agenten-Prompt bereits rund 9.900 Tokens hatte.

- `--ctx-size` ist nicht mehr fest 8192, sondern je Modell wählbar: Stufen ab 16k bis zur Trainingslänge aus dem GGUF-Kopf (höchstens 1M, Standard 32k), gespeichert in `local-models.json`. Derselbe Wert wird OMP als `contextWindow` gemeldet.
- Pro Stufe wird Modell plus f16-KV-Cache geschätzt; Stufen über 85 % des Arbeitsspeichers sind gesperrt (auch serverseitig), über 65 % als knapp markiert. Der GGUF-Kopf wird gepuffert gelesen, große Tokenizer-Listen werden übersprungen, Gewichte nie geladen.
- Änderung bei geladenem Modell oder laufendem Vorgang wird abgewiesen; nach einem Engine-Absturz ist sie möglich.
- 19/19 Node-Tests, darunter synthetischer GGUF-Kopf über 1 MB, schichtweise KV-Köpfe, MLX-`text_config`, Speicherstufen bei 16/128 GB, Persistenz und Sperren.
- Engine-Start mit aufzeichnender `llama-server`-Attrappe: `--ctx-size 65536` übergeben, `contextWindow: 65536` in `models.yml`.
- Electron: Modellzeile zeigt Stufen 16k–1M mit Bedarf, sperrt 1M (ca. 129,5 GB bei 128 GB RAM) und speichert 512k.
- Grenze: Sliding-Window-/Hybrid-Attention wird nicht herausgerechnet; die Schätzung liegt dort zu hoch. Grafikspeicher bei Vulkan wird nicht gemessen.
- Auf Windows offen: echte CPU-/Vulkan-Inferenz mit 32k Kontext und ein vollständiger Agentenlauf mit einem kleinen lokalen Modell.

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

- Datei: `dist/Pi-Desk-0.3.1-Windows-x64.zip` (05.10.2026)
- Größe: 269.414.566 Bytes
- SHA-256: `d1347531edc8ebfb3e48198a21a0eaff168843a2ee891a23b96c39085216eb36`
- ZIP-CRC vollständig geprüft
- `Pi Desk.exe` und `resources/runtime/omp.exe`: PE32+ x86-64 bestätigt
- OMP-Runtime im Paket bytegenau gegen die offizielle Prüfsumme geprüft
- `app.asar` enthält Version 0.3.1, die Kontextplanung in `local-models.mjs` und die Auswahl je Modell in `public/features.js`; `START.txt`, `README-WINDOWS.md` und Testliste tragen 0.3.1
- Vorgänger `Pi-Desk-0.3.0-Windows-x64.zip` (SHA-256 `4b783165…bb7d`) bleibt unverändert im Ordner

Kein Setup.exe: `npm run build:installer` bleibt für einen echten Windows-Build vorbereitet. Windows ARM64 wurde nicht gebaut.
