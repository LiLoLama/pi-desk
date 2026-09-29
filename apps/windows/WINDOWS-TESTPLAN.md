# Windows-Testliste · Pi Desk 0.2.0

Bitte mit einem kleinen Testprojekt beginnen. Bei einem Fehler notieren: Windows-Version, CPU/GPU, Modell/Anbieter, konkrete Schritte, erwartetes/tatsächliches Ergebnis und sichtbare Fehlermeldung. Keine API-Schlüssel oder vertraulichen Chats in Fehlerberichte kopieren.

## 1. Start und Grundlagen

- [ ] ZIP vollständig entpacken, `Pi Desk.exe` starten: Fenster erscheint, keine separate Node-/OMP-Installation erforderlich.
- [ ] Zweiter Start: bestehendes Fenster wird aktiviert, keine konkurrierenden Agentenprofile.
- [ ] Projektordner mit Leerzeichen/Umlauten auswählen; neues Projekt und neue Aufgabe anlegen.
- [ ] Anbieter-Login im Standardbrowser vollständig abschließen, ggf. Code eingeben; Modell wählen und Antwort erhalten.
- [ ] Alternativ kompatible API/Ollama/LM Studio speichern, testen, bearbeiten und entfernen.
- [ ] Stream, Markdown-Tabelle, Code, Denkinhalte (falls geliefert), Dateilinks und Werkzeuggruppen prüfen.
- [ ] Fenster schmal/breit, Zoom, Windows-Skalierung und Systemmenü über Alt prüfen.

## 2. Agentenarbeit und Genehmigungen

- [ ] Agent soll eine kleine Testdatei schreiben: ablehnen → Datei bleibt unverändert; erneut anfragen und erlauben → Datei wird geschrieben.
- [ ] Für Chat merken: gleiches Werkzeug im selben Chat wird wieder erlaubt; anderer Chat fragt weiter nach.
- [ ] Global merken: Regel gilt auch in anderem Chat. App neu starten und Persistenz prüfen; Regeln anschließend löschen.
- [ ] Modi Nachfragen/Dateien erlauben/Vollzugriff mit harmlosen Aufträgen prüfen.
- [ ] Längeren Auftrag starten, zwei Folgenachrichten einreihen und eine entfernen: nur die verbleibende wird ausgeführt.
- [ ] Slash-Befehl wie `/help` in Warteschlange prüfen; danach folgt die nächste normale Nachricht.
- [ ] Alt+Enter zur unmittelbaren Steuerung; Stoppen und Unterbrechen prüfen. Entfernen gilt nur für noch nicht übergebene Folgeaufträge.
- [ ] Während laufender Arbeit Fenster schließen: Rückfrage abbrechen, dann schließen; anschließend keine verwaisten Pi-Desk-/OMP-Prozesse.

## 3. Dateien und Bilder

- [ ] Projektbaum, Textvorschau und Datei als Kontext verwenden; im Explorer anzeigen.
- [ ] In einem Git-Projekt eine Datei verändern und Diff ansehen.
- [ ] PNG/JPEG aus Datei und Zwischenablage anhängen; einzelnes Bild entfernen; Bild ohne Begleittext senden.
- [ ] Mit einem bildfähigen Modell tatsächlichen Bildinhalt beschreiben lassen. Maximal vier Bilder, je 4 MB und insgesamt 8 MB.
- [ ] Datei außerhalb des Projekts als Projektkontext wählen: verständliche Ablehnung.

## 4. Chats und Sitzungen

- [ ] Suche, umbenennen, archivieren/wiederherstellen, Papierkorb/wiederherstellen, endgültig löschen.
- [ ] App neu starten: Projekt, Verlauf und Einstellungen vorhanden.
- [ ] Nachricht kopieren, als Entwurf bearbeiten und erneut senden; Antwort in neuem Chat fortsetzen.
- [ ] Modell/Denkaufwand/Fast-Modus, Statistiken, Befehle und Komprimieren prüfen.
- [ ] Sitzung verzweigen: unabhängiger Verlauf; Sitzung importieren: unabhängige Kopie.
- [ ] HTML exportieren und gespeicherte Datei im Browser prüfen.
- [ ] Handoff mit ausreichend langem Verlauf; Ablehnung bei zu kurzem Verlauf ist möglich und muss sichtbar sein.
- [ ] Sitzungsreset nur in einem Wegwerfchat prüfen.
- [ ] Optional öffentliches Teilen ausschließlich mit bewusst gewähltem Testinhalt: Bestätigung prüfen, dann Link öffnen.
- [ ] Todos anlegen/abhaken; Subagenten bei einem passenden Auftrag samt Verlauf ansehen.
- [ ] Harmlosen Shell-Befehl ausführen und lang laufenden Befehl abbrechen.

## 5. Alle Einstellungsbereiche

- [ ] Anbieter: Login/API/Modellserver-Verbindungen.
- [ ] Agent: persönliche Hinweise, Denkaufwand, Warteschlangenmodus sowie relevante erweiterte Schalter speichern und nach Neustart kontrollieren. Werkzeuge können zusätzliche Software voraussetzen.
- [ ] Skills: lokalen Ordner hinzufügen, Vorschau, aktivieren/deaktivieren, entfernen. Windows-Verknüpfung ohne Entwicklermodus prüfen.
- [ ] MCP: Testserver als stdio/HTTP/SSE hinzufügen, Verbindung testen, ändern, deaktivieren und entfernen. Zugangsdaten bei leerer Eingabe unverändert lassen.
- [ ] Plugins/Hooks: vertrauenswürdiges lokales Testplugin hinzufügen/aktivieren/deaktivieren/entfernen; optional externe Quelle installieren (kann zusätzliche Voraussetzungen haben).
- [ ] Darstellung: Schrift, reduzierte Bewegung, Pi-Begleiter und vier Kürzel ändern; Neustart; doppelte/reservierte Kürzel ablehnen.
- [ ] Projektregeln: AGENTS.md/CLAUDE.md und angebotene Regeldateien speichern; Unterordner werden angelegt. Nur im Testprojekt prüfen.
- [ ] Worktrees: Git muss installiert sein. Anlegen/öffnen; geänderte oder neue Dateien verhindern Entfernen; sauberen Test-Worktree entfernen.
- [ ] Archiv: Chat wiederherstellen, Papierkorb leeren mit Bestätigung.

## 6. Lokale Modelle – getrennt testen

- [ ] Modellordner hinzufügen, GGUF scannen, Ordner entfernen.
- [ ] Öffentliches GGUF-Modell suchen, Datei/Größe wählen und herunterladen; Fortschritt, Abbruch und Fehlerdarstellung prüfen.
- [ ] CPU-Backend wählen, kleines Modell laden: Engine-Download/Entpacken und tatsächliche Antwort prüfen.
- [ ] Modell entladen, Vulkan wählen und auf geeignetem GPU-System erneut laden/antworten; bei Treiberproblemen CPU erneut testen.
- [ ] Nach App-Neustart Modell erneut laden; Server beim Schließen beenden.
- [ ] Ollama/LM Studio als unabhängigen Weg testen. MLX wird unter Windows nicht angeboten.

## Bekannte Grenzen

Kein Setup-Installer, keine Signatur/Autoaktualisierung, keine native ARM64-Ausgabe, keine MLX-Engine. Keine eingebettete interaktive Terminal-/Web-/PDF-Ansicht. Todos/Subagenten und Pi-Begleiter sind gegenüber der nativen Mac-App vereinfacht. Für bestimmte Plugins, Browser-/Computerwerkzeuge oder MCP-Server sind externe Voraussetzungen nötig. Ein sichtbarer Schalter beweist nicht, dass diese auf jedem PC installiert sind.

Die bisherigen automatisierten Prüfungen liefen unter macOS. Diese Liste dient insbesondere der noch offenen Windows-, Login- und Inferenzprüfung.
