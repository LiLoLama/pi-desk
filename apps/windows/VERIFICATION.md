# Windows-Port 0.2.0 – Prüfstand 28.09.2026

## Erfolgreich auf macOS

- `npm test`: 13 Tests bestanden. RPC-Chunks, Dateigrenzen/Symlink-Ausbruch, Einstellungen/Secrets, Skills/MCP, Modellscan, Windows-Pfade/Runtime, URL-Filter, persistente Genehmigungen, Regel-Unterordner, Schutz geänderter Worktrees und festgelegte CPU-/Vulkan-Downloads.
- `npm run test:host`: zufälliger Port, Token-Schutz, doppelte Engine blockiert, Beenden über stdin-EOF und Lock-Bereinigung.
- `npm run test:parity` mit echter Mac-OMP-Runtime und lokalem Testmodell: Schreiben ablehnen/erlauben, Chat-Freigabe nach Backend-Neustart wiederverwenden; entfernte Folgenachricht erreicht Modell nicht, verbleibende wird ausgeführt, vorgeschalteter Slash-Befehl blockiert sie nicht. Echte Sitzungsverzweigung, HTML-Export und unabhängiger Import erfolgreich. Handoff meldet die OMP-Ablehnung bei zu kurzer Sitzung korrekt; ein erfolgreicher Handoff-Export wurde damit nicht nachgewiesen.
- `npm run test:desktop`: echte Electron-Oberfläche in temporärem Profil, isolierter Renderer, Einstellungen, Auswahl-Brücke, Projekt mit Umlauten/Leerzeichen, echte OMP-Sitzung und Dateivorschau.
- `npm run test:desktop-parity`: alle zehn Einstellungsbereiche; Skills-Aktivierung, lokale Plugins/Hooks, echter MCP-Probeaufruf, Regeldatei im Unterordner, echter Git-Worktree, Darstellung/Kürzel, Modellscan, Todos per RPC, Papierkorb/Wiederherstellung. Bildanhänge als Bedienablauf und sichere Markdown-Tabellen geprüft, keine Bildinferenz. Kompakte Ansicht ohne horizontales Überlaufen. Systemdialoge wurden im automatischen Test durch feste Antworten ersetzt.
- Visuelle Desktop-Prüfung: `verification/v020-agent-settings.png`, `v020-mcp.png`, `v020-compact-settings.png`. Diese zeigen den Port unter macOS, keinen Windows-Lauf.
- Windows-OMP-Binary/Lizenzen anhand festgelegter SHA-256-Werte geprüft. Offizielles llama.cpp-CPU-Archiv zusätzlich heruntergeladen: SHA-256, ZIP-CRC, x64-PE-Header und enthaltene DLLs geprüft; nicht ausgeführt. Vulkan-Download ist ebenfalls mit SHA-256 festgelegt.

Testläufe verwenden isolierte temporäre Profile und lokale Modellfixtures, keine persönlichen Anbieter-Zugangsdaten. Für die Integrationsprüfungen wurde `PI_DESK_OMP` auf die passende Mac-OMP-Binary gesetzt. Die Desktop-Paritätsprüfung benötigt zusätzlich `PI_DESK_TEST_NODE` für ihren lokalen MCP-Testserver.

Bei Electron erschien eine macOS-Sandbox-Diagnose (`sandbox_extension_issue_file … Operation not permitted`); die geprüften Abläufe liefen dennoch erfolgreich. Das ist keine Windows-Beobachtung.

## Auf Windows offen

Die detaillierten Schritte stehen in [WINDOWS-TESTPLAN.md](WINDOWS-TESTPLAN.md). Noch nicht nachgewiesen sind insbesondere echter Windows-Start, native Windows-Dialoge, Windows-OAuth, tatsächliche Vision-Inferenz, PowerShell-Entpacken der lokalen Engine, CPU-/Vulkan-Modellinferenz, GPU-Treiberverträglichkeit und Prozessbereinigung unter Windows. Öffentliche Freigabe und externe Plugin-Installationen wurden nicht ausgelöst. Die Oberfläche für zusätzliche Werkzeuge ersetzt deren externe Voraussetzungen nicht.

## Paketierung

Electron 44.4.5, electron-builder 26.15.3, OMP 18.2.1. ZIP mit `Pi Desk.exe`, Electron/Node, `resources/app.asar`, `resources/runtime/omp.exe`, Lizenzen, Startanleitung, README und Windows-Testliste. Keine persönlichen Profile oder Zugangsdaten werden übernommen.

Kein Setup.exe: Der NSIS-Build aus der ersten Fassung scheiterte am nicht ausführbaren Intel-Mac-Compiler auf diesem ARM-Mac (`Unknown system error -86`). `npm run build:installer` bleibt für Windows vorbereitet, dort ungetestet. Keine Signatur, Autoaktualisierung oder native Windows-ARM64-Ausgabe.

Abschließend ebenfalls bestanden: `npm run test:http` (Zugriffsschutz, Projekt/Kontext/Anbieter, Policy-Neustart, Wiederanlauf, Archiv/Papierkorb samt Wiederherstellung und endgültigem Löschen).

Das fertige ZIP wurde vollständig mit CRC geprüft. Beide EXE-Dateien tragen AMD64-PE-Header, die enthaltene OMP-Binary entspricht der festgelegten SHA-256. 21 verpackte Server-/Desktop-/UI-Quelldateien stimmen bytegenau mit dem Quellstand überein; Paketmetadaten, YAML/Marked/DOMPurify und beigepackte Anleitungen wurden geprüft.

- Datei: `dist/Pi-Desk-0.2.0-Windows-x64.zip`
- Größe: 259.907.093 Bytes (ca. 260 MB)
- SHA-256: `c2a2af6fff2b6089fae95ce8812182255bdb0eb204168b03d08cdac2a50ff549`
- Prüfsummen: `dist/SHA256SUMS.txt`
