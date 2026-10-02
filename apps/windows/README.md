# Pi Desk für Windows · 0.3.0

Eigenständiger Windows-Port in einem eigenen Ordner. Die native Mac-App bleibt unverändert. Der vorhandene OMP-Unterbau läuft in einer isolierten Electron-Desktop-App mit der bestehenden Quiet-Studio-Gestaltung.

## Start auf Windows

1. `dist/Pi-Desk-0.3.0-Windows-x64.zip` vollständig auf einem Intel-/AMD-PC entpacken.
2. **Pi Desk.exe** starten. Alle Begleitdateien zusammenlassen.
3. Anbieter verbinden oder unter Einstellungen einen kompatiblen Modellserver hinzufügen.
4. Mit **Strg+O** einen Projektordner öffnen, Modell wählen und Nachricht senden.

Electron, Node und OMP 18.4.10 sind enthalten. Für die grundlegende App ist keine Node-/Bun-Installation erforderlich. Git wird für Git-Funktionen und Worktrees zusätzlich benötigt; bestimmte externe Plugins können eigene Voraussetzungen haben. WSL ist für den App-Start keine Voraussetzung.

Das Paket ist nicht signiert und enthält keinen automatischen Updater. Es ist ein ZIP mit startbarer EXE, kein Setup-Installer. Windows ARM64 wurde nicht gebaut.

## Funktionen

- Projekte, persistente Chats, Suche, Umbenennen, Archiv und Papierkorb mit Wiederherstellen/endgültigem Löschen.
- Streaming, Modellwechsel, Denkaufwand, Fast-Modus, Komprimierung, Statistiken, Slash-Befehle und Sitzungsreset.
- Echte Genehmigungen: einmalig, werkzeugspezifisch für den Chat oder global; gespeicherte Regeln lassen sich löschen. Anbieter-Sicherheitsabfragen werden nicht automatisch bestätigt.
- Mit OMP 18.4.10 synchronisierte Warteschlange mit einzeln entfernbaren Folgeaufträgen; sofortige Steuerungsnachricht, Unterbrechen und Stoppen. Agentenarbeit gilt erst nach dem vollständigen RPC-Sitzungsabschluss als beendet.
- Bildanhänge aus Datei oder Zwischenablage, Textdateien als Kontext, Projektbaum, Textvorschau, Git-Diffs und Explorer-Anzeige.
- Markdown mit Tabellen, Listen, Code und Dateilinks; kopieren, Nachricht als neuen Entwurf bearbeiten, Antwort in neuem Chat fortsetzen; einklappbare Denkinhalte, sofern das Modell sie liefert.
- Sitzungen importieren, verzweigen und als HTML speichern. Handoff und Teilen über die OMP-Funktionen, jeweils mit sichtbaren Fehlern bzw. Bestätigung vor Veröffentlichung.
- Todos bearbeiten, Subagenten und deren Verlauf ansehen; Shell-Befehl ausführen/abbrechen.
- Zehn Einstellungsbereiche: Anbieter, lokale Modelle, Agent, Skills, MCP, Plugins/Hooks, Darstellung, Projektregeln, Worktrees und Archiv.
- Skills verknüpfen/aktivieren, MCP-Verbindungen anlegen/bearbeiten/testen, lokale Plugins/Hooks und externe Plugin-Quellen verwalten.
- Erweiterte Agent-Einstellungen, Projektregeln bearbeiten, Git-Worktrees anlegen/öffnen/entfernen. Worktrees mit lokalen Änderungen werden nicht gelöscht.
- Schriftgröße, reduzierte Bewegung, vier anpassbare Tastenkürzel und ein optionaler kleiner Pi-Begleiter.
- Lokale GGUF-Modelle finden, herunterladen, laden und verwenden. Die Windows-Engine wird bei Bedarf als geprüfter CPU- oder Vulkan-Download eingerichtet. Alternativ Ollama, LM Studio oder kompatible API verbinden.

## Bedienung

| Kürzel | Aktion |
|---|---|
| Strg+O | Projekt öffnen |
| Strg+N | Neue Aufgabe |
| Strg+K | Suche |
| Strg+, | Einstellungen |
| Strg+Umschalt+I | Dateien/Vorschau |
| Enter | Senden bzw. einreihen |
| Umschalt+Enter | Absatz |
| Alt+Enter | Laufenden Agenten unmittelbar steuern |
| Strg+Plus / Minus / 0 | Zoom |

Die ersten drei Kürzel und das Kürzel für Dateien/Vorschau lassen sich anpassen. Bearbeiten einer Nachricht erzeugt einen Entwurf; erneutes Senden ergänzt den Verlauf. Bereits an OMP übergebene Steuerungsnachrichten lassen sich nicht einzeln zurückziehen.

## Grenzen und Teststand

Die Funktionen sind weitgehend zugänglich, aber nicht in jedem Detail identisch mit SwiftUI: MLX ist auf Windows nicht verfügbar; der Pi-Begleiter ist vereinfacht; Todos verwenden zusätzlich einen JSON-Editor, Subagenten eine einfache Verlaufsansicht. Es gibt kein eingebettetes interaktives Terminal und keine gerenderte Web-/PDF-Vorschau. Handoff kann bei kurzen oder bereits komprimierten Sitzungen vom Agenten abgelehnt werden. Geschützte Hugging-Face-Modelle mit zusätzlicher Anmeldung sind nicht Teil des Download-Dialogs.

Gemeinsame Logik, echte OMP-18.4.10-Prozesse und die Electron-Oberfläche wurden auf macOS mit isolierten Profilen geprüft. Ein tatsächlicher Windows-Lauf, Windows-OAuth, Bildinferenz und CPU-/GPU-Inferenz müssen auf Windows geprüft werden. Externe Plugin-Installation wurde nicht ausgelöst. Details: [VERIFICATION.md](VERIFICATION.md). Für deinen Test: [WINDOWS-TESTPLAN.md](WINDOWS-TESTPLAN.md).

## Daten und Rechte

Desktop-Profil: `%LOCALAPPDATA%\Pi Desk\desktop`

Agent-Konfiguration, Anmeldungen und Sitzungen: `%LOCALAPPDATA%\Pi Desk\engine`. OMP kann weitere Caches im Benutzerprofil anlegen. Mac-Anmeldungen werden nicht kopiert. API-Schlüssel liegen in der lokalen Konfiguration, nicht im Windows Credential Manager.

Genehmigungen sind keine Dateisystem-Sandbox: erlaubte Agentenwerkzeuge arbeiten mit den Rechten des Windows-Benutzers. Die Oberfläche ist isoliert, der Loopback-Dienst verwendet einen zufälligen Port und Starttoken. Modell-Markdown wird bereinigt. Export erfolgt über einen nativen Speicherdialog.

## Selbst bauen

Node 22 oder neuer und npm:

```powershell
npm ci
npm run build:win
```

Für die Entwicklung: `npm run runtime:win`, anschließend `npm start`. Wenn npm Installationsskripte blockiert, muss das offizielle Electron-Installationsskript freigegeben werden. Die Downloads sind mit SHA-256 fixiert, npm-Abhängigkeiten im Lockfile.

`npm run build:installer` ist für einen zusätzlichen NSIS-Installer unter Windows vorbereitet. Hier konnte kein Setup erstellt werden, weil der Intel-Mac-NSIS-Compiler auf dem ARM-Mac nicht ausführbar war. Der ZIP-Build funktioniert unabhängig davon.

Mac-Entwicklung mit passender OMP-Binary:

```sh
PI_DESK_OMP="$PWD/../macos/runtime/omp" npm start
```

## Quellen und Lizenzen

- [Oh My Pi 18.4.10](https://github.com/can1357/oh-my-pi/releases/tag/v18.4.10)
- [llama.cpp b11013](https://github.com/ggml-org/llama.cpp/releases/tag/b11013)
- [Electron-Sicherheitsrichtlinien](https://www.electronjs.org/docs/latest/tutorial/security)
- [Marked](https://marked.js.org/) und [DOMPurify](https://github.com/cure53/DOMPurify)

Drittanbieterhinweise liegen unter `licenses/` und im Paket unter `resources/licenses/`. Electron-Lizenzen liegen ebenfalls im Paket.
