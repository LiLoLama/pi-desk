# Pi Desk

Lokale grafische Oberfläche für [Oh My Pi](https://github.com/can1357/oh-my-pi), auf dem freigegebenen Quiet-Studio-Design aufgebaut.

## Native macOS-App

Die fertige Anwendung liegt unter **`dist/Pi Desk.app`**. Zum Verschicken an einen anderen Apple-Silicon-Mac: **`dist/Pi-Desk-0.3.0-apple-silicon.dmg`**. Per Doppelklick starten; optional nach `Programme` verschieben. Node und OMP sind enthalten, ein Terminal oder Browserfenster wird für die Bedienung nicht benötigt. Die Oberfläche besteht aus **SwiftUI und AppKit**, ohne WebView/Electron.

Apple Silicon, Build-Ziel macOS 14 oder neuer; auf dem aktuellen Mac getestet. Releases sind mit Developer ID signiert und von Apple notarisiert. Lokale Builds ohne `PI_DESK_SIGN_ID` bleiben ad-hoc signiert.

1. **Anbieter verbinden**: bestehendes Anbieter-Abo über OMP anmelden. Die externe Autorisierungsseite öffnet sich im Standardbrowser; Codes/Weiterleitungsadressen werden im nativen Dialog eingegeben.
2. **⌘O** öffnet die native macOS-Ordnerauswahl.
3. Modell wählen und Nachricht mit **Return** senden. **Shift-Return** erzeugt einen Absatz. Während der Arbeit legt **Return** die Nachricht in die Warteschlange, **⌥Return** greift sofort ein.
4. **⌘N** startet eine neue Aufgabe. **⌘,** öffnet Einstellungen. **⌥⌘I** schaltet Dateien/Vorschau um.

Die App startet und beendet ihren lokalen Hintergrundprozess selbst. Er verwendet einen zufälligen Loopback-Port und ein geheimes Token pro App-Start. Ein Lock verhindert, dass zwei Engines gleichzeitig dieselben Sitzungsdaten verändern. Beim Beenden eines laufenden Vorgangs fragt die App nach.

### Neu bauen

```sh
npm ci --ignore-scripts
npm run sparkle
python3 native/build.py
```

`npm run sparkle` lädt Sparkle 2.10.0 SHA-256-geprüft nach `vendor/`. Erfordert Xcode/Swift, Node.js 22+ und die gepinnte OMP-Runtime (`node install-runtime.mjs`). `native/PiDesk.swift` enthält Oberfläche, API-Adapter und App-Lifecycle. Das Skript erstellt das Icon, bündelt die Laufzeiten und prüft die Codesignatur. Mit gesetztem `PI_DESK_SIGN_ID` (Developer-ID-Name) signiert es mit Hardened Runtime; ohne entsteht ein ad-hoc signierter Entwicklungs-Build (`PIDeskDevBuild`), der den Update-Feed über `PI_DESK_UPDATE_FEED` überschreiben lässt. `PI_DESK_TEST_FEED_BUILD=1` ist nur für lokale Tests gedacht; das Release-Skript weist solche Builds ab. Es kopiert nur eine echte Node-Mach-O-Binary, keine Wrapper-Skripte (Goose/Hermit). Optional `PI_DESK_NODE` auf den gewünschten `node`-Pfad setzen. Der YAML-Parser wird über den Lockfile installiert und mit der App gebündelt. Für Benutzer der fertigen App ist keine Installation im Terminal nötig.

### Browser-Entwicklungsansicht

Die frühere Browseroberfläche bleibt als Entwicklungsansicht erhalten:

```sh
npm start
```

Sie verwendet http://127.0.0.1:8767. Vorher die native App beenden, da beide standardmäßig dasselbe Datenverzeichnis nutzen. Die native App benötigt diesen Browser-Server nicht.

Die App startet keine kostenpflichtige Inferenz automatisch. Der vollständige Login mit dem persönlichen Anbieter-Abo muss vom Benutzer abgeschlossen werden.

## Funktionsumfang

- Echte OMP-Prozesse, Streaming, Stoppen und persistente Sitzungen pro Aufgabe. Während der Arbeit kannst du weitere Nachrichten in die Warteschlange legen (↵) oder sofort eingreifen (⌥↵); Stopp bleibt ein eigener Knopf. Wartende Nachrichten erscheinen über dem Composer und lassen sich entfernen.
- Projekte, neue Aufgaben, Umbenennen und Suche. Chats per Rechtsklick archivieren oder in den Papierkorb verschieben; unter „Archiv & Papierkorb“ wiederherstellen. Laufende Aufgaben und offene Genehmigungen müssen zuerst abgeschlossen werden. Papierkorb ist wiederherstellbar; endgültiges Löschen und Leeren entfernen Chat und Sitzungsdatei, nicht die Projektdateien.
- OAuth-Anmeldung, dynamische Modellauswahl. Native Einstellungen über Zahnrad / ⌘,: Ollama, LM Studio und OpenAI-kompatible APIs hinzufügen, testen, bearbeiten und entfernen. Automatische Discovery oder manuelle Modell-IDs; optionaler API-Schlüssel.
- Persönliche Agent-Hinweise und der Standard-Denkaufwand gelten global für Pi Desk. Am Composer gibt es bei unterstützten Modellen **Aufwand**; über **⋯** an der Aufgabe Komprimieren, Export, Handoff, Verzweigen, Fast-Mode und Befehle. Todos und Subagenten erscheinen im Chat. Schriftgröße, reduzierte Animationen und vier anpassbare Tastaturkürzel wirken nativ und bleiben gespeichert.
- Kontextauswahl am Composer; oben Dateien oder Ordner über den macOS-Dialog, darunter der Projektbaum. Textdateien werden tatsächlich an die Nachricht angehängt. Bis 10 Dateien, je 250 KB, insgesamt 400 KB. Bilder aus der Zwischenablage mit **⌘V** anhängen (max. 4); sie erscheinen als Vorschau über dem Composer und gehen mit der Nachricht an OMP.
- Chat-Nachrichten rendern Markdown nativ (Überschriften, Listen, Code, Tabellen, Links), ohne HTML oder WebView. Pfade und Dateilinks im Chat öffnen die Textvorschau rechts; Rechtsklick zeigt die Datei im Finder. Vom Modell gelieferte Gedanken erscheinen als aufklappbarer „Gedanken des Modells“-Abschnitt; Modelle ohne solche Daten erzeugen keinen leeren Platzhalter. Nachrichtenaktionen sind sichtbar als Kopieren, Bearbeiten und Neuer Chat beschriftet.
- Dateibaum und Textvorschau rechts. Git-Status und Diffs für staged/unstaged Änderungen, einschließlich Änderungen, die bereits vor dem Agentenlauf existierten. Neue untracked Dateien sind im Status und Dateibaum sichtbar. Im Dateibaum und in der Vorschau gibt es „Im Finder zeigen“.
- Werkzeugergebnisse füllen den Chat nicht einzeln: während der Arbeit zeigt eine standardmäßig geöffnete Statuszeile Laufzeit, aktuelle Modellgedanken und bereits eingegangene Werkzeugschritte mit verständlichen deutschen Namen und – sofern von OMP geliefert – ihrem Zweck. Danach werden aufeinanderfolgende Werkzeugergebnisse zu einem kompakten, aufklappbaren Arbeitsblock mit Details und Ausgabe zusammengefasst.
- Echte Genehmigungsdialoge. Standard **Nachfragen**: Schreiben und Shell-Befehle bestätigen. **Dateien erlauben**: Schreiben erlauben, Shell bestätigen. **Vollzugriff**: beides automatisch. Zusätzlich kann ein angefragtes Werkzeug einmalig, für den aktuellen Chat oder global erlaubt werden. Dauerregeln gelten nur für das benannte Werkzeug, werden lokal gespeichert und unter **Einstellungen → Agent → Automatische Genehmigungen** zurückgesetzt. Anbieter-Sicherheitsprüfungen und generische Bestätigungen werden nie automatisch freigegeben. Moduswechsel startet den Agenten im Leerlauf mit derselben Sitzung neu.
- Verbindungsabbrüche sichtbar; erneutes Laden rekonstruiert Chat und offene Genehmigungen, solange der Serverprozess lebt. Nach Serverneustart bleibt die gespeicherte Unterhaltung erhalten; laufende Generierungen werden nicht automatisch wiederholt.

## Updates

Pi Desk sucht 10 Sekunden nach dem Start und danach alle 6 Stunden nach einer neuen Version (Sparkle 2.10.0). Gibt es eine, erscheint der Changelog mit **Jetzt aktualisieren**, **Später** und **Diese Version überspringen**. Während ein Agent arbeitet, eine Anmeldung läuft oder Hintergrundaufgaben aktiv sind, wird nur geladen und beim nächsten Beenden installiert; **Jetzt neu starten** fragt dann wie das Beenden nach. **Einstellungen → Updates** schaltet die automatische Suche ab oder prüft sofort; ebenso **Pi Desk → Nach Updates suchen …**. Updates benötigen eine App im Programme-Ordner (oder einem anderen beschreibbaren Ordner), nicht im Disk-Image oder in App Translocation; die App weist darauf hin.

Quelle ist `updates/macos/appcast.xml` in diesem Repository; das DMG selbst ist ein Anhang am GitHub-Release. Sparkle prüft jede Datei mit dem eingebauten EdDSA-Schlüssel (`native/sparkle-public-key.txt`), bevor es sie installiert. Pi Desk verwendet dafür eine eigene SwiftUI-Oberfläche statt der Standarddialoge von Sparkle.

## Release veröffentlichen

Einmalig: Sparkle-Schlüssel (`vendor/sparkle/bin/generate_keys`, privat im Schlüsselbund und Passwortmanager) und Notarisierungsprofil (`xcrun notarytool store-credentials pi-desk-notary …`).

1. Version in `package.json` erhöhen, Abschnitt in `CHANGELOG.md` schreiben.
2. `PI_DESK_SIGN_ID="Developer ID Application: …" PI_DESK_NOTARY_PROFILE=pi-desk-notary npm run release:draft`: Build, Notarisierung, DMG, EdDSA-Signatur, Entwurfs-Release `macos-vX.Y.Z`, lokale Änderung an `updates/macos/appcast.xml`. Das Skript prüft vorab Branch `main`, sauberen Arbeitsbaum und `HEAD == origin/main` und weist Test-Feed-Builds ab.
3. Entwurf herunterladen und testen.
4. `npm run release:publish` veröffentlicht nach Rückfrage („ja“) das Release, prüft Entwurf und DMG-Größe gegen den Feed, committet nur den Feed und pusht `main`.

Zurückrollen: Feed-Commit zurücksetzen. Bereits aktualisierte Installationen bleiben auf der Version.

## Grenzen dieser ersten Version

Keine gerenderte Web-/Bildvorschau und kein integriertes Terminal. Todos und Subagenten erscheinen als native Leiste bzw. Liste, nicht als TUI-Karten. Vorschau zeigt Text/Quellcode. Markdown im Chat wird nativ als Text gesetzt, nicht als HTML ausgeführt. Neue Aufgaben benötigen zunächst eine Modellauswahl, wenn das Startmodell nicht zum angemeldeten Anbieter passt. Nicht jeder OMP-Login-Anbieter unterstützt den RPC-Login; entsprechende Fehler werden angezeigt.

**Genehmigungen sind keine Sandbox.** OMP läuft mit den Rechten des lokalen Benutzers. Bestätigte Befehle und erlaubte Schreibwerkzeuge können auch außerhalb des Projektordners arbeiten. Der Dateibrowser/Kontextpicker selbst begrenzt Pfade einschließlich Symlinks auf den geöffneten Projektordner. Geladene Werkzeuge: read, write, edit, bash, grep, glob, ast_edit, ask, debug, eval, lsp, task, wait, todo, web_search. Unter **Einstellungen → Agent** lassen sich Browser-Use, Computer-Use, PTY, Advisor, Memory, Prewalk, Erweiterungen und Projekt-MCP schalten. Skills, MCP, lokale Plugins/Hooks und Projektregeln (AGENTS.md) haben eigene Einstellungsseiten.

## Daten und Sicherheit

Anmeldungen, Sitzungen und Projektliste: `~/Library/Application Support/Pi Desk/`. Diese Daten liegen bewusst außerhalb des synchronisierten Quellcodeordners. Das Verzeichnis erhält Modus 0700; die App-Metadaten 0600. OMP verwaltet seinen eigenen Auth-Speicher. Die OMP-Binärdatei legt zusätzlich native Laufzeitmodule/Daemon-Daten unter `~/.omp/` ab.

Der Webserver bindet ausschließlich 127.0.0.1, validiert Host und Origin und verlangt für API-Zugriffe ein zufälliges HttpOnly/SameSite-Cookie. Mutationen benötigen einen zusätzlichen Header. Kein CORS, kein direkter Zugriff auf Runtime oder App-Daten. Projektdateien werden als Text escaped, nicht als HTML ausgeführt. Keine Telemetrie in Pi Desk; Anbieter- und OMP-Netzwerkzugriffe gehören zur Runtime.

## Runtime

Offizielle Release-Binärdatei **OMP 18.4.10**, `omp-darwin-arm64`:
https://github.com/can1357/oh-my-pi/releases/tag/v18.4.10

SHA-256: `23d3f9ab712fe700e80a43dbd1e8159dfea8e106bf717648a49b1bba1ad3e508`

`runtime/` ist gitignored. Nach erneutem Auschecken `node install-runtime.mjs` ausführen. Andere Plattformen sind noch nicht paketiert. Der Adapter verwendet **rpc-ui**, weil reguläres rpc die Werkzeug-Genehmigungsoberfläche nicht injiziert. Protocol v2 mit validierter Chunk-Rekonstruktion.

## Prüfen

```sh
npm test
node test/runtime-smoke.mjs
node test/queue.test.mjs
node test/http-smoke.mjs
node test/native-host.mjs
node test/settings-smoke.mjs
node test/capabilities-smoke.mjs
node test/mcp-transports-smoke.mjs
node --test test/session-rpc.test.mjs
node --test test/extensions.test.mjs
```

Runtime-Test: echter OMP-Prozess gegen deterministisches lokales Testmodell, Ablehnen/Erlauben einer temporären Dateiänderung, Streaming und Sitzung fortsetzen. Kein externer Modellaufruf, keine persönlichen Zugangsdaten. HTTP-Test: eigene temporäre Daten auf Port 8768; die normale App darf auf 8767 weiterlaufen.

Der native Host-Test prüft den zufälligen Port, Token-Schutz, Doppelstart-Sperre und Prozessende bei geschlossenem App-Kanal. Ein zusätzlicher UI-Lauf mit separat kompiliertem `PI_DESK_UI_TEST`-Build und `test/native-fixture.mjs` prüfte die echten SwiftUI-Dialoge und einen vollständigen Schreibvorgang ohne externes Modell.

`PI_DESK_PORT` und `PI_DESK_DATA` dienen lokalen Tests. Das Datenverzeichnis niemals auf einen geteilten Cloud-Ordner setzen.

## Einstellungen: Bestandsaufnahme

[SETTINGS-AUDIT.md](SETTINGS-AUDIT.md) dokumentiert die ursprüngliche Bestandsaufnahme gegen OMP 18.2.1; die für OMP 18.4.10 überarbeitete Laufzeit-, RPC- und Tool-Abdeckung steht in [FEATURE-PARITY.md](FEATURE-PARITY.md) und [VERIFICATION.md](VERIFICATION.md). Die Prüfung aktiviert keine zusätzlichen Funktionen.

## Vollständige OMP-Abdeckung

[FEATURE-PARITY.md](FEATURE-PARITY.md) ist die verbindliche Arbeitsliste für vollständige native OMP-Funktionalität. Sie enthält die offenen Funktionsbereiche sowie den Abgleich der 55 RPC-Kommandos und 30 Built-in-Werkzeuge von OMP 18.4.10. Das Gesamtziel ist noch nicht erfüllt.

## Einstellungen verwenden

Unter **Modelle & Anbieter → +** Typ, Name und Server-URL wählen. Ollama: `http://127.0.0.1:11434`; LM Studio: `http://127.0.0.1:1234/v1`. Den Server in der jeweiligen App starten. „Verbindung testen“ liest die Modellliste ohne Inferenz. Modell-IDs leer lassen für automatische Discovery; manuell eingetragene IDs verwenden zunächst 32.768 Kontext- und 4.096 Ausgabetokens. Danach speichern und das Modell im Chat auswählen.

Ein leer gelassenes Schlüsselfeld behält den vorhandenen Schlüssel; Entfernen ist explizit. Bei einer URL-Änderung muss ein vorhandener Schlüssel neu eingegeben oder entfernt werden. Die App zeigt gespeicherte Schlüssel nicht erneut an. Verbindungen und Engine-Präferenzen liegen im privaten Datenverzeichnis (Dateimodus 0600), einschließlich der OMP-kompatiblen Modellkonfiguration. API-Schlüssel werden dort gespeichert, derzeit nicht im macOS-Schlüsselbund. Fremde Provider und YAML-Kommentare bleiben erhalten.

Konfigurationsänderungen werden nur angenommen, wenn alle Worker und Anmeldungen im Leerlauf sind. Danach startet die ausgewählte Sitzung mit den neuen Werten wieder; die Unterhaltung bleibt erhalten. Aktuell globaler Pi-Desk-Geltungsbereich, noch keine Projekt-Overrides.

„Tastaturkürzel“ erlaubt neue Belegungen für Neue Aufgabe, Projekt öffnen, Chats suchen und Dateien/Vorschau. Duplikate und reservierte macOS-Befehle werden abgewiesen. Die übrigen Standardmenüs behalten ihre Systemkürzel.


## Skills und MCP verwenden

**Einstellungen → Skills → +** verbindet den lokalen Ordner mit `SKILL.md`. Neue Skills sind zunächst ausgeschaltet. Vorschau, Suche, Quellpfad und Aktivierung sind verfügbar. Trennen entfernt nur die Pi-Desk-Verknüpfung; der Originalordner bleibt erhalten. Ein Skill muss gültiges YAML-Frontmatter mit `name` und `description` besitzen. Automatische Skill-Quellen bleiben deaktiviert; nur explizit aktivierte Skills werden geladen. Repository-Download und automatische Updates sind noch nicht enthalten.

**Einstellungen → MCP → +** richtet ein lokales Programm (`stdio`), einen HTTP- oder SSE-Endpunkt ein. Argumente werden als JSON-Liste eingegeben; Header/Umgebungsvariablen als JSON-Objekte. Leere Felder behalten gespeicherte Werte; `{}` oder der Entfernen-Schalter löschen sie. Bei Zieländerungen werden vorhandene Werte nicht unbemerkt übertragen. Geheimnisse liegen in der privaten `agent/mcp.json` (0600), noch nicht im Schlüsselbund. Neue OAuth-Anmeldungen sind noch nicht angebunden.

„Verbindung testen“ startet den angegebenen Prozess bzw. verbindet den Endpunkt, initialisiert MCP und liest die Werkzeugliste ohne Werkzeugaufruf oder Modellanfrage. „Ladezustand prüfen“ liest die tatsächlich in der ausgewählten Sitzung angebotenen Skills und MCP-Werkzeugrouten. OMP 18 bietet MCP-Werkzeuge über `xd://`-Routen an. Aktivieren/Deaktivieren übernimmt die Konfiguration im Leerlauf und lädt die Sitzung erneut. Die bestehenden Genehmigungsmodi gelten auch für MCP-Aufrufe. Projekt-MCP bleibt deaktiviert.


## Lokale Modellbibliothek

**Einstellungen → Lokale Modelle** trennt direkte Ausführung von **Anbieter & APIs** (Konten und bereits laufende Server). Unter **Ordner** lassen sich mehrere bestehende Modellordner verbinden, einschließlich erkannter LM-Studio- und Hugging-Face-Cache-Verzeichnisse. Originale werden nicht kopiert, verschoben oder gelöscht. Die Bibliothek erkennt GGUF samt zusammengehörigen Teildateien sowie Safetensors-Modellordner mit Konfiguration und Tokenizer; die konkrete Architektur muss von der Engine unterstützt werden.

**Laden** richtet beim ersten Mal die passende Engine im privaten Pi-Desk-Datenverzeichnis ein und startet sie selbst. Es ist keine laufende Ollama-/LM-Studio-App nötig. **Im aktuellen Chat verwenden** wählt das geladene Modell aus. Ein Modell gleichzeitig; **Entladen** gibt Speicher frei. Während laufender Agentenarbeit/Genehmigungen werden Modellwechsel und Entladen abgewiesen. Nach App-Neustart sind die Ordner weiterhin verbunden; das Modell wird bewusst erst durch Laden wieder in den Speicher geholt. Ein ungeladenes lokales Modell wird nicht still für eine externe Modellanfrage ersetzt.

**Entdecken** durchsucht öffentliche Hugging-Face-Modelle nach MLX/GGUF. Die ersten zwölf populären Treffer werden mit Dateimetadaten angereichert und nach geschätzter Speicherpassung, dann Downloads sortiert. GGUF bevorzugt unter gleich passenden Varianten Q4_K_M. Dies ist eine Speicher-Heuristik (Dateigröße × 1,25 + 2 GiB Reserve), kein Geschwindigkeits-/Qualitätsbenchmark und keine Garantie für Architektur- oder Tool-Calling-Kompatibilität. Details zeigen Lizenz, Quantisierung/Datei, Größe, Speicherpassung und Zielordner. Downloads nutzen die angezeigte Commit-Version, prüfen LFS-SHA-256 und Dateigröße, zeigen Fortschritt und lassen sich abbrechen. Neue Version seit Detailansicht → erneute Auswahl. Gated/private Modelle benötigen derzeit den vorherigen Download außerhalb der App.

Engines: offizielles [llama.cpp b11013](https://github.com/ggml-org/llama.cpp/releases/tag/b11013) für GGUF; [mlx-lm 0.31.3](https://pypi.org/project/mlx-lm/0.31.3/) in eigener Python-Umgebung, eingerichtet mit [uv 0.12.15](https://github.com/astral-sh/uv/releases/tag/0.12.15). Runtime-Archive sind SHA-256-gepinnt. Downloads/Installation benötigen Internet, danach erfolgt Inferenz lokal. Der aktuelle Installer unterstützt Apple-Silicon-Macs. Die app-interne API bindet nur an Loopback und verlangt einen zufälligen Sitzungsschlüssel; der zugrunde liegende MLX-Dienst bleibt lokal auf Loopback. Modellkontext zunächst 8.192 Tokens / max. 2.048 Ausgabe.

Zusätzliche Prüfungen:

```sh
node test/local-host-smoke.mjs
node test/local-download-smoke.mjs
# Opt-in: echte Engine-Downloads und lokale Inferenz in /private/tmp:
node test/gguf-engine-smoke.mjs
node test/local-engine-smoke.mjs /absoluter/pfad/zu/einem/MLX-Modell
```

## GitHub-Download

[macOS-Vorabversion 0.3.0](https://github.com/LiLoLama/pi-desk/releases/tag/macos-v0.3.0): DMG für Apple Silicon mit OMP 18.4.10. Developer-ID-signiert und notarisiert, ab dieser Version mit automatischen Updates; einmalig manuell installieren. Drittanbieter-Lizenzen (OMP, YAML und Sparkle, siehe `licenses/SPARKLE-LICENSE.txt`) liegen im App-Paket und auf dem DMG.
