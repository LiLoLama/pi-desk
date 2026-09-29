# Umzug am 29.09.2026

Auftrag: Pi Desk als eigenes Projekt im Developer-Ordner führen und beide Plattformen zusammen ordnen.

| Bisher im Studio Workspace | Jetzt relativ zum Repository |
|---|---|
| output/pi-desk-app | apps/macos |
| output/pi-desk-windows | apps/windows |
| output/pi-desk-designs | docs/design/explorations |
| output/pi-desk-mockup | docs/design/mockup |
| output/pi-desk-app.zip | archive/pi-desk-app-legacy.zip |

Alle Dateien einschließlich ignorierter Runtime-, Build- und Abhängigkeitsdateien wurden kopiert. Vor Änderungen wurden Dateiinhalt (SHA-256), Dateimodus und Symlink-Ziele vollständig verglichen. Die Zuordnung und Anzahl stehen in `migration-inventory.json`. Die Originale wurden anschließend innerhalb des Studio Workspace unter `output/_archive/pi-desk-2026-09-29` als Umzugssicherung eingeordnet; nichts davon wurde gelöscht.

Neue aktive Wurzel: `/Users/liam/Developer/LIAM/pi-desk`. Eigenes Git-Repository auf `main`, ohne Commit oder Remote. Die Git-Historie des privaten Workspace wurde nicht übernommen. Es erfolgte kein Push und keine Veröffentlichung.

Die Windows-Entwicklungsanleitung verweist jetzt auf `../macos/runtime/omp`. Buildskripte ermitteln ihre Wurzel relativ zur eigenen Datei und benötigten keine Änderung. Bereits gebaute ZIPs/DMGs bleiben bytegleich; ihre beigepackten Anleitungen sind historische Momentaufnahmen. Der aktuelle Quellstand enthält die neue Pfadangabe.

## Prüfung am neuen Ort

- macOS: 13 Tests erfolgreich, darunter Markdown-Parser, Queue und echte OMP-Sitzungssteuerung.
- Windows-Port: 13 Tests erfolgreich.
- Beide lokalen Host-Tests erfolgreich (Token, zufälliger Port, Engine-Lock, Beenden).
- Windows-Port mit Mac-OMP: Genehmigungen und Neustart-Persistenz, entfernbare Warteschlange, Verzweigung, HTML-Export und unabhängiger Import erfolgreich.
- Electron-Desktop-Smoke-Test am neuen Ort erfolgreich: isolierter Renderer, API, Einstellungen, Auswahl-Brücke, OMP-Sitzung, Dateivorschau und kompaktes Layout.
- Bestehende Mac-App: `codesign --verify --deep --strict` erfolgreich nach dem Kopieren.

Kein neuer Release gebaut. Das vorhandene Mac-DMG vom 18.09. ist älter als die App vom 21.09.; ein Release muss den beabsichtigten Quellstand neu bauen und prüfen. Reale Windows-Prüfung weiterhin offen.

## Weiterarbeit

Das Repository als eigenes Projekt in der Entwicklungs-App öffnen. Builds bleiben unter der jeweiligen App in `dist/`, die Gitignore-Regeln schließen sie und Runtime/Abhängigkeiten aus. Vor Veröffentlichung Lizenzwahl und Pakete prüfen. Keine Nutzerprofile oder Zugangsdaten wurden aus den installierten Apps übernommen.
