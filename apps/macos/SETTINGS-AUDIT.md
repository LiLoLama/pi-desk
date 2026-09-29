# Pi Desk: Einstellungen und OMP-Abdeckung

Stand: 16.09.2026. Historische Bestandsaufnahme vor der Implementierung.

**Fortschritt:** Native Einstellungen, lokale/OpenAI-kompatible Verbindungen mit Verbindungstest, globale persönliche Hinweise/Denkaufwand, Schriftgröße/Bewegung und anpassbare native Kürzel sind inzwischen implementiert. Aktuellen Status und verbleibende Arbeit beschreibt [FEATURE-PARITY.md](FEATURE-PARITY.md); die folgende Tabelle dokumentiert den Ausgangsbefund.

## Ergebnis

Die meisten gewünschten Engine-Funktionen existieren bereits. Pi Desk bildet derzeit einen schmalen Ausschnitt ab und schaltet mehrere OMP-Fähigkeiten explizit ab. Ein natives Einstellungsfenster samt Konfigurationsadapter fehlt. Kein Engine-Wechsel notwendig.

Geprüft: lokaler OMP-Quellstand `acf943d3c8dc1ed135b42aa33fef4d9d2ff61c9a`, Tag **v18.2.1**, passend zur gebündelten Runtime. Quellenlinks unten sind auf diesen Tag fixiert. Keine Behauptung über vollständige Funktionsparität mit einem neueren Release. Kein Live-Test eines lokalen Modellservers, Plugins oder Browsers in dieser Prüfung.

## Abdeckung

| Bereich | OMP 18.2.1 | Pi Desk / benötigte Arbeit |
| --- | --- | --- |
| Ollama, LM Studio, llama.cpp | Eingebaute Discovery, auch implizit an lokalen Endpunkten; Custom-Provider in models.yml | Nicht grundsätzlich blockiert, aber ohne Einrichtung, Endpoint-Felder, Verbindungstest und Discovery-Fehleranzeige. Modellliste kann bereits automatisch gefundene Modelle enthalten. |
| Eigene API-Endpunkte | OpenAI-kompatible und weitere APIs, Modellmetadaten, Header, Auth-Konfiguration | Native Provider-Verwaltung fehlt; OAuth-Login allein deckt das nicht ab. |
| Skills | Discovery, eigene Verzeichnisse, Quellfilter, einzelne Skills deaktivieren | Lokale Ordner gezielt verbinden, Quellpfad/Vorschau, Aktivierung und Laufzeitprüfung implementiert. Weitere Discovery-Quellen und Installations-/Updateverwaltung offen. |
| Plugins / Extensions | npm-, Git-, lokale und Marketplace-Quellen, Aktivierung, Features, Konfiguration, Diagnose | --no-extensions deaktiviert den Extension-Ladeweg. Plugin-Manager-Aufrufe und native UI fehlen. Bun wird bei Installationen als externes Programm gestartet; unser Bundle enthält bisher nur Node und OMP. |
| Hooks | Ereignisbehandlung über ExtensionRunner; JS/TS-Factories und Discovery | Extension-Ladeweg deaktiviert. Quelle, Ereignisse, Aktivierung, Fehler und Testlauf brauchen UI. Alte Hook-Dokumentation nicht als separaten aktiven Runner implementieren. |
| Verbindungen / MCP | Serverkonfiguration, lokale Prozesse und HTTP-Transporte, Auth, Aktivierung, Discovery | Native stdio-/HTTP-/SSE-Verwaltung, Header/Env, Aktivierung, Verbindungstest und Laufzeit-Werkzeugliste implementiert. Projekt-MCP deaktiviert; OAuth-Anmeldung und Projekt-Overrides offen. |
| Browser-Use | Browser-Fassade im Eval-Werkzeug, Chromium/CDP/Relay, Headless und Lifecycle-Optionen | Native Schalter in Einstellungen → Agent: Tool `browser`, Headless, optionale CDP-URL, Persistenz und Worker-Neustart im Leerlauf. Chromium-Status, Relay-Installation und Computer-Use offen. |
| Agent-Personalisierung | AGENTS.md, Regeln, APPEND_SYSTEM.md, SYSTEM.md und Modellrollen | Native Bearbeitung und wirksamen Geltungsbereich anzeigen. Für zusätzliche persönliche Hinweise bevorzugt anhängen, nicht unbemerkt den gesamten Standardprompt ersetzen. |
| Erscheinungsbild / Bewegung | OMP-Themes betreffen die Terminaloberfläche | Schriftgröße, Akzent, Bewegungen und weitere macOS-UI-Präferenzen in Pi Desk selbst umsetzen. |
| Tastaturkürzel | keybindings.yml für OMPs Terminalaktionen | Native Shortcuts sind aktuell fest in SwiftUI verdrahtet. Eigener Shortcut-Recorder mit Konfliktprüfung nötig; TUI-Bindings wirken dort nicht automatisch. |
| Git / Worktrees | Git-Werkzeuge, Worktree-Verzeichnis, Clone-Optionen, /wt und CLI-Verwaltung, Isolation-Backends | Pi Desk zeigt nur Git-Status und Diff. Aufgaben an Worktrees binden, erzeugen, wechseln und aufräumen benötigt eigene Integration. |
| Umgebungen | Profile, Konfigurationsbereiche, Prozessumgebung, Shell/Isolation-Einstellungen | Projektprofile, Arbeitsordner, Umgebungsvariablen und Setup-Abläufe sind als native Produktfunktion noch zu bauen. Daraus folgt kein vorhandenes allgemeines VM-/Container-Management. |

## Konkrete Ursachen im Adapter

`server.mjs:32–34` schreibt eine Policy-Überlagerung bei jedem Workerstart und übergibt:

- --no-extensions, --no-skills, --no-lsp, --no-pty.
- --tools=read,write,edit,bash,grep,glob für Aufgaben.
- mcp.enableProjectConfig=false.
- PI_CODING_AGENT_DIR auf den privaten Pi-Desk-Datenordner.

Die Abtrennung des Datenordners ist sinnvoll, bedeutet aber: Einstellungen aus ~/.omp/agent werden nicht automatisch zur Pi-Desk-Konfiguration. Plugin-Datenwurzeln werden separat aufgelöst; vor einem Installer muss geklärt sein, ob er eine geteilte oder app-eigene Registry verändert. Ein blindes Entfernen der Startflags ist kein fertiges Einstellungsfeature.

## Vorgeschlagene native Struktur

Ein echtes macOS-Einstellungsfenster über Zahnrad und Cmd-Komma, mit Suche und folgenden Bereichen:

1. Allgemein und Darstellung
2. Modelle und Anbieter — Abo, API, lokaler Server
3. Agent — persönliche Hinweise, Modellvorgaben und Verhalten
4. Skills
5. Plugins und Hooks
6. Verbindungen — MCP und Browser
7. Projekte und Umgebungen — Git und Worktrees
8. Tastaturkürzel
9. Erweitert — effektive Konfiguration und Diagnose

Quiet Studio Dark beibehalten: einfache Zeilen, dezente Trennlinien, wenige Container. Bei Einstellungen sind kurze sichtbare Bezeichnungen nötig. „Global“ und „Dieses Projekt“ explizit unterscheiden; Herkunft und überschriebene Werte sichtbar machen. Keine funktionslosen Schalter als Platzhalter.

## Technische Anbindung

- App-Präferenzen und Engine-Konfiguration getrennt halten. Native Darstellung/Shortcuts liegen bei Pi Desk; OMP-Werte in dessen unterstützten Konfigurationsformaten.
- OMP bietet `config list --json` mit Wert, Typ und Beschreibung sowie `config set/get/reset`. Die aktuelle RPC-Typdefinition enthält keine universelle Settings-CRUD-Schnittstelle. Native Settings deshalb über einen kontrollierten Backend-Adapter an die CLI/Dateiformate anbinden; einzelne Modell-/Verhaltensänderungen können vorhandenes RPC verwenden.
- CLI mit exakt demselben Agent-Verzeichnis, Projekt und Policy-Kontext aufrufen. Keine Shell-Interpolation aus Formularwerten. `config set` schreibt standardmäßig global; Projektwerte benötigen einen expliziten Schreibpfad.
- Schema prüfen, atomar speichern, unbekannte Einträge erhalten. Policy-Überlagerung darf Benutzereinstellungen nicht still überschreiben. Effektiven Wert nach dem Speichern rücklesen.
- Modellkonfiguration gesondert über models.yml verwalten. Lokale Server: URL, Auth optional, Verbindung testen, Modelle abrufen, manuelle Modell-ID als Fallback. Nicht bloß einen OAuth-Dialog anzeigen.
- Geheimnisse geschützt behandeln; nicht in Suchindizes, Logs oder allgemeinen Konfigurationsansichten ausgeben. `config list --json` redigiert Credential-Werte, einzelne `config get`-Aufrufe können sie offen ausgeben.
- Änderungen mit Worker-Neustart erst im Leerlauf übernehmen, Session fortsetzen und betroffene Aufgaben sichtbar machen. Keine laufende Generierung still beenden.
- Plugins/Browser benötigen zusätzliche Laufzeitprüfung. Fremder Plugin-Code kann schon beim Installationsvalidieren initialisiert werden; Quelle und Aktivierung müssen im Bedienpfad sichtbar sein.
- Worktree cleanSource ist standardmäßig false und kann Quelländerungen zurücksetzen/entfernen. Nicht als beiläufigen Komfortschalter aktivieren. Worktree-Isolation ist keine OS-Sandbox.

## Umsetzung in überprüfbaren Schritten

1. Einstellungsfenster, Persistenz und Geltungsbereiche; lokale Modelle inklusive Verbindungstest; native Darstellung, Personalisierung und Shortcuts.
2. Skills und MCP mit Listen, Herkunft, Aktivierung, Diagnose und kontrolliertem Reload.
3. Plugin-Installation, Hooks und Browser samt Abhängigkeiten und Status.
4. Projektumgebungen, Git-/Worktree-Lifecycle und Task-Zuordnung.

Abnahme: Speichern/Neustart/Rücklesen, lokale Modellantwort inklusive Tool-Aufruf, Skill tatsächlich im Agentenkontext, MCP-Aufruf, Plugin-Ladefehler sichtbar, Browser-Verbindung, Shortcut-Konflikt, Worktree-Zuordnung ohne Änderung des ursprünglichen Checkouts. Bis dahin gilt jeweils „im Repository vorhanden“, nicht „in Pi Desk fertig“.

## Quellen

Alle Links auf den tatsächlich geprüften Runtime-Stand:

- [Modelle / Discovery](https://github.com/can1357/oh-my-pi/blob/v18.2.1/docs/models.md)
- [Implizite lokale Provider](https://github.com/can1357/oh-my-pi/blob/v18.2.1/packages/coding-agent/src/config/model-registry.ts)
- [Settings und CLI](https://github.com/can1357/oh-my-pi/blob/v18.2.1/docs/settings.md)
- [Settings-Schema inkl. Browser und Worktrees](https://github.com/can1357/oh-my-pi/blob/v18.2.1/packages/coding-agent/src/config/settings-schema.ts)
- [Config und Profile](https://github.com/can1357/oh-my-pi/blob/v18.2.1/docs/config-usage.md)
- [Skills](https://github.com/can1357/oh-my-pi/blob/v18.2.1/docs/skills.md)
- [Plugin-Manager](https://github.com/can1357/oh-my-pi/blob/v18.2.1/docs/plugin-manager-installer-plumbing.md)
- [Hooks](https://github.com/can1357/oh-my-pi/blob/v18.2.1/docs/hooks.md)
- [MCP](https://github.com/can1357/oh-my-pi/blob/v18.2.1/docs/mcp-config.md)
- [Browser](https://github.com/can1357/oh-my-pi/blob/v18.2.1/docs/tools/browser.md)
- [Personalisierung](https://github.com/can1357/oh-my-pi/blob/v18.2.1/docs/system-prompt-customization.md)
- [TUI-Keybindings](https://github.com/can1357/oh-my-pi/blob/v18.2.1/docs/keybindings.md)
- [RPC-Vertrag](https://github.com/can1357/oh-my-pi/blob/v18.2.1/packages/coding-agent/src/modes/rpc/rpc-types.ts)
