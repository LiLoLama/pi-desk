# Vollständige OMP-Abdeckung für Pi Desk

Verbindliches Produktziel aus der Nutzeranweisung vom 16.09.2026: Die vollständige nutzerseitige Funktionalität von Oh My Pi soll in der nativen macOS-App zugänglich sein. Kein bewusst dauerhaft reduzierter Chat-Client. Wesentliche Endnutzerfunktionen von OMP 18.2.1 sind nativ angebunden. Restlücken: Live-Collab (`omp join`), ACP/Headless als Editor-Protokoll, gated Hub-Login, Bun für npm-Marketplace-Deinstallationen.

Referenz: gebündeltes OMP **v18.2.1**, Commit `acf943d3c8dc1ed135b42aa33fef4d9d2ff61c9a`. Bei Runtime-Updates Inventar und Abnahmetests vergleichen. „Im Repository vorhanden“ zählt nicht als „in Pi Desk implementiert“.

## Abnahmeregeln

Für jede Fähigkeit: auffindbare native Bedienung, tatsächliche Backend-Anbindung, persistente Konfiguration mit Geltungsbereich, verständliche Fehler/Zustände und nachvollziehbare Funktionsprüfung. Keine Platzhalterschalter. TUI-spezifische Präsentation in eine native Entsprechung übersetzen; keine Behauptung, OMPs Terminal-Theme ändere SwiftUI. Reine Protokoll-/SDK-/Deployment-Einstiegspunkte getrennt von Endnutzerfunktionen dokumentieren, statt sie still als erledigt auszusortieren.

Zusätzlicher Pi-Desk-Umfang: Archiv, Papierkorb/Wiederherstellung, native Personalisierung, Shortcut-Verwaltung, Desktop-Pets. Diese Funktionen sind teils GUI-eigene Aufgaben.

## Arbeitsbereiche und aktueller Stand

| Bereich | Stand / verbleibende Arbeit |
| --- | --- |
| Chat-Lifecycle | Erstellen, Umbenennen, Suche, Archiv, Papierkorb, Wiederherstellen, endgültiges Löschen und Leeren implementiert und HTTP-getestet. |
| Rendering und Eingaben | Text-Streaming, natives Markdown, klickbare Projektpfade, Nachrichtenaktionen und Clipboard-Bilder (⌘V, max. 4) vorhanden. Dateiformate, echtes Reasoning und Artefakte vollständig abbilden. |
| Session-Lifecycle | Resume, Verzweigung, HTML-Export, Handoff, Statistik, Share-Link, Sitzungsdatei-Import, neue Sitzung und Befehlspalette angebunden. Live-Collab (`omp join`) bleibt CLI. |
| Prompt-Steuerung | Senden, Stoppen, Queue, Steer/Interrupt, Steering-/Follow-up-/Interrupt-Modi, Fast-Mode, Komprimierung, Auto-Retry und Retry-Abbruch angebunden. |
| Modelle | OAuth und Auswahl vorhanden. Ollama/LM Studio/OpenAI-kompatible Verbindungen, optionale Schlüssel, Discovery-Test und globaler Thinking-Level implementiert. Automatische Discovery mit echtem OMP gegen lokale Fixture getestet. Direkte lokale Modellbibliothek mit mehreren Ordnern, GGUF/MLX, verwalteten Engines, Hugging-Face-Suche/Downloads und Speicher-Heuristik implementiert; echte Inferenz in beiden Formaten geprüft. Gated-Hub-Anmeldung, weitere Architekturen und konfigurierbare lokale Runtime-Parameter offen. Rollen und Routing bleiben CLI-seitig. Fast-Mode, Retry und Compaction sind angebunden. |
| Einstellungen | Native Oberfläche für Modelle, Agent-Werkzeuge, Memory/Advisor, Queue-Modi, Darstellung und Shortcuts; validierte globale Persistenz und Worker-Neustart im Leerlauf. Vollständiges OMP-Schema und Herkunftsanzeige je Projektwert offen. |
| Personalisierung | Persönliche Hinweise, Chat-Schriftgröße, reduzierte Animationen, Shortcuts und nativer AGENTS.md-/CLAUDE.md-Editor pro Projekt. |
| Skills / Plugins / Hooks | Skills, lokale Plugin-Ordner, Hooks, npm-/Git-Installation und Marketplace-Quelle angebunden. npm-Deinstallation braucht Bun im PATH. |
| MCP / Verbindungen | Native Serververwaltung für stdio/HTTP/SSE getestet. Projekt-MCP optional in den Einstellungen. Neue OAuth-Anmeldung und erweiterte Serveroptionen offen. |
| Tools / Entwicklung | Runtime-Katalog: read, write, edit, bash, grep, glob, ast_edit, ask, debug, eval, lsp, task, hub, todo, web_search. PTY, Memory, Advisor, GitHub-CLI-Befehl und Security bleiben schaltbar bzw. über Slash-Befehle erreichbar. Genehmigungen bleiben werkzeugbezogen. |
| Browser / Computer | Browser-Use und Computer-Use in den Einstellungen. Sichtbare Chromium-Tabs und Relay-Installation bleiben OMP-Runtime. |
| Subagenten / Planung | Todo-Leiste, Subagentenliste und Event-Abo angebunden. Isolation/Worktrees und Plan-Resolve-Karten bleiben offen. |
| Git / Worktrees | Status/Diff und Worktree anlegen/entfernen im Inspektor. Commit/Review/PR bleiben Agent-Werkzeuge. |
| Memory / Advisor | Memory-Backend und Advisor in den Einstellungen; zugehörige Tools werden mitgeladen. Autolearn-Feinsteuerung und Watchdog-UI offen. |
| Recherche / Medien | Websuche-Tool standardmäßig aktiv. Spezielle PDF/URL-Vorschauen in der nativen Oberfläche weiter Text-only. |
| Betriebsfunktionen | Native gebündelte Engine und lokaler Token-/Lifecycle-Schutz vorhanden. Updates, Diagnose, Netzwerk-/Proxy-/Provideroptionen und Datenverwaltung vervollständigen. |
| Weitere CLI-Einstiegspunkte | ACP, SDK, Headless, Auth-Gateway/Broker, Remote-Sharing und Dienst-/CLI-Kommandos einzeln auf native Verwaltung oder dokumentierten Integrationszugang prüfen. Noch nicht abgenommen. |

## RPC-Inventar

Aus dem Command-Union-Typ der gepinnten Version extrahiert. „Angebunden“ bedeutet vorhandenen Aufrufpfad, nicht automatisch vollständige UI-Parität.

| RPC | Pi Desk |
| --- | --- |
| `negotiate_protocol` | Angebunden |
| `prompt` | Angebunden |
| `steer` | Angebunden |
| `follow_up` | Angebunden |
| `abort` | Angebunden |
| `abort_and_prompt` | Angebunden |
| `new_session` | Angebunden |
| `get_state` | Angebunden |
| `set_fast_mode` | Angebunden |
| `get_available_commands` | Angebunden; Befehlspalette sendet den Slash-Befehl als Nachricht |
| `set_todos` | Angebunden |
| `set_host_tools` | Offen |
| `set_host_uri_schemes` | Offen |
| `set_subagent_subscription` | Angebunden |
| `get_subagents` | Angebunden |
| `get_subagent_messages` | Angebunden |
| `set_model` | Angebunden |
| `cycle_model` | Angebunden |
| `get_available_models` | Angebunden |
| `set_thinking_level` | Angebunden |
| `cycle_thinking_level` | Angebunden |
| `set_steering_mode` | Angebunden |
| `set_follow_up_mode` | Angebunden |
| `set_interrupt_mode` | Angebunden |
| `compact` | Angebunden |
| `set_auto_compaction` | Angebunden |
| `set_auto_retry` | Angebunden |
| `abort_retry` | Angebunden |
| `bash` | Angebunden |
| `abort_bash` | Angebunden |
| `get_session_stats` | Angebunden |
| `export_html` | Angebunden |
| `switch_session` | Für Verzweigungsrückkehr angebunden |
| `branch` | Angebunden |
| `get_branch_messages` | Angebunden |
| `get_last_assistant_text` | Angebunden |
| `set_session_name` | Angebunden |
| `handoff` | Angebunden |
| `get_messages` | Angebunden |
| `get_messages_page` | Angebunden |
| `get_login_providers` | Angebunden |
| `login` | Angebunden |

## Built-in-Tool-Inventar

Aus BUILTIN_TOOLS des gepinnten Quellstands. Dynamische/bedingte Tools, Eval-Preludes und Plugin-/MCP-Tools zusätzlich erfassen; dieses Inventar ist kein vollständiger Beweis der aktiv geladenen Tools.

| Tool | Pi Desk |
| --- | --- |
| `read` | Freigegeben |
| `security_scan` | Schaltbar |
| `bash` | Freigegeben |
| `edit` | Freigegeben |
| `ast_grep` | In dieser Runtime nicht im `--tools`-Katalog |
| `ast_edit` | Freigegeben |
| `ask` | Freigegeben |
| `debug` | Freigegeben |
| `eval` | Freigegeben |
| `github` | In dieser Runtime nicht im `--tools`-Katalog |
| `glob` | Freigegeben |
| `grep` | Freigegeben |
| `lsp` | Freigegeben, abschaltbar |
| `checkpoint` | In dieser Runtime nicht im `--tools`-Katalog |
| `rewind` | In dieser Runtime nicht im `--tools`-Katalog |
| `context_notes` | In dieser Runtime nicht im `--tools`-Katalog |
| `new_context` | In dieser Runtime nicht im `--tools`-Katalog |
| `task` | Freigegeben |
| `hub` | Freigegeben |
| `todo` | Freigegeben |
| `web_search` | Freigegeben, abschaltbar |
| `write` | Freigegeben |
| `memory_edit` | Über Memory-Backend / xd://, nicht als `--tools`-Name |
| `retain` | Über Memory-Backend / xd:// |
| `recall` | Über Memory-Backend / xd:// |
| `reflect` | Über Memory-Backend / xd:// |
| `learn` | Über Memory-Backend / xd:// |
| `manage_skill` | Über Memory-Backend / xd:// |

## Reihenfolge

1. Live-Collab-Gäste und ACP-Host in fremden Editoren.
2. Gated Hugging-Face-Login und Bun-Marketplace-Deinstallation.
3. Native PDF/URL-Vorschau statt Text-only.
4. Gegen gesamte CLI-, Schema-, RPC- und Tool-Inventare abgleichen.

Prüfung je Block gegen isolierte Daten und lokale Modellfixtures. Persönliche Login-/Remote-Dienste separat prüfen; ungetestete Provider-Kompatibilität nicht als validiert markieren.

Quellen: [CLI](https://github.com/can1357/oh-my-pi/blob/v18.2.1/docs/cli-reference.md), [RPC](https://github.com/can1357/oh-my-pi/blob/v18.2.1/packages/coding-agent/src/modes/rpc/rpc-types.ts), [Tools](https://github.com/can1357/oh-my-pi/blob/v18.2.1/packages/coding-agent/src/tools/index.ts), [Funktionsübersicht](https://github.com/can1357/oh-my-pi/blob/v18.2.1/README.md), [Settings-Audit](SETTINGS-AUDIT.md).
