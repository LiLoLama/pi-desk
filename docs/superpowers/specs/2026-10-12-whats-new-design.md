# „Neu in dieser Version“ nach Updates – Design

Stand: 12.10.2026 · Status: abgestimmt, noch nicht umgesetzt

## Ziel

Nach einem Update mit größeren Änderungen erfährt man beim ersten Start einmal, was neu ist. Bei reinen Fehlerbehebungen bleibt es still. Der Changelog ist außerdem jederzeit in der App abrufbar.

Bisher zeigt Pi Desk den Changelog nur vor dem Update im Update-Dialog, und zwar aus dem Feed. Wer „Beim Beenden installieren“ wählt oder ein Update später nachholt, sieht ihn danach nicht mehr. Die App enthält die `CHANGELOG.md` bisher nicht.

## Entscheidungen

| Thema | Entscheidung |
|---|---|
| Wann erscheint das Fenster | Wenn sich Haupt- oder Mittelnummer gegenüber der zuletzt gesehenen Version erhöht hat (0.3.x → 0.4.0). Patch-Versionen (0.3.0 → 0.3.1) zeigen nichts. Keine zusätzliche Markierung im Changelog. |
| Inhalt | Alle Changelog-Abschnitte mit gesehen < Version ≤ installiert, neueste oben. |
| Quelle | Die mit der App ausgelieferte `CHANGELOG.md` der jeweiligen Plattform. Kein Netzwerkzugriff. |
| Merken | Mac: `UserDefaults`-Schlüssel `whatsNew.seenVersion`. Windows: Feld `seenVersion` in der bestehenden `desktop/updates.json`. |
| Plattformen | Gleicher Ablauf, getrennt umgesetzt. Kein gemeinsames Modul. |

## 1. Verhalten für Nutzer (beide Plattformen)

**Beim Start**, nachdem das Hauptfenster steht:

| Gespeicherte Version | Installierte Version | Ergebnis |
|---|---|---|
| keine | beliebig | Kein Fenster. Installierte Version merken. |
| 0.3.1 | 0.4.0 | Fenster mit Abschnitt 0.4.0. Merken. |
| 0.3.0 | 0.4.2 | Fenster mit 0.4.2, 0.4.1, 0.4.0, 0.3.1 (alle übersprungenen). Merken. |
| 0.4.0 | 0.4.1 | Kein Fenster. Merken. |
| 0.4.0 | 0.4.0 | Nichts. |
| 0.5.0 | 0.4.0 | Downgrade: kein Fenster. Installierte Version merken. |
| 0.3.1 | 0.4.0, aber der Changelog hat keinen passenden Abschnitt | Kein Fenster. Merken. |

- „Keine gespeicherte Version“ umfasst Neuinstallationen und den ersten Start der Version, die diese Funktion einführt. Beides lässt sich nicht unterscheiden. Das erste Fenster erscheint deshalb frühestens beim nächsten Sprung der Mittelnummer danach.
- Die Version gilt als gesehen, sobald das Fenster erscheint, nicht erst beim Schließen. Ein Absturz oder Beenden bei offenem Fenster führt nicht dazu, dass es bei jedem Start wieder erscheint.

**Das Fenster**
- Titel „Neu in Pi Desk X.Y“ (Haupt- und Mittelnummer der installierten Version), darunter die Abschnitte als Markdown wie im Update-Dialog, scrollbar.
- Ein Knopf „Verstanden“ (Standardaktion, auch Esc schließt).
- Links im Changelog öffnen nur `https`/`http` im Standardbrowser, wie im Update-Dialog.
- Findet die automatische Update-Prüfung währenddessen eine neue Version, erscheint deren Dialog erst nach dem Schließen. Eine manuelle Prüfung („Nach Updates suchen“) schließt das Fenster nicht, ihr Dialog kommt danach.

**Jederzeit abrufbar**
- Einstellungsseite „Updates“: Knopf „Was ist neu“.
- Mac zusätzlich im App-Menü unter „Nach Updates suchen …“: „Was ist neu …“.
- Zeigt dasselbe Fenster mit den letzten zehn Abschnitten bis zur installierten Version. Ändert die gespeicherte Version nicht.

## 2. Regel als reine Funktion

Beide Plattformen bekommen eine reine, getestete Funktion mit gleicher Bedeutung:

```
whatsNew(changelog, seen, installed) → { show: bool, notes: string, remember: string }
```

- `remember` ist immer `installed`. Der Aufrufer speichert es, sobald das Ergebnis vorliegt. So gilt die Version als gesehen, bevor das Fenster erscheint.
- `show` ist wahr, wenn `seen` gesetzt ist, `installed > seen` gilt, sich `major.minor` unterscheidet und mindestens ein Abschnitt im Bereich liegt.
- `notes` enthält die Abschnitte im Bereich, neueste oben, im Format des Update-Dialogs (`## X.Y.Z – Datum` und Text).
- Ungültige gespeicherte Werte gelten wie „keine“.

**Mac:** Erweiterung von `native/UpdateLogic.swift` um einen Changelog-Parser (Überschriften `## X.Y.Z – Datum`, wie `scripts/changelog.mjs`) und `whatsNew`. Für Versionsvergleiche wird `UpdateLogic.compare` wiederverwendet.

**Windows:** Erweiterung von `desktop/changelog.cjs` um `whatsNew`. Sie nutzt die vorhandenen Funktionen `parseChangelog`, `compareVersions` und `renderNotes`.

## 3. macOS

- `native/build.py` kopiert `CHANGELOG.md` nach `Contents/Resources/CHANGELOG.md`.
- Ein neuer `WhatsNew`-Teil in `native/Updates.swift` liest die Datei, wendet die Regel an, speichert die Version und zeigt bei Bedarf ein eigenes Fenster im Stil des Update-Fensters: Quiet Studio Dark, `ChatMarkdown`, 520 pt breit. Das Fenster ist vom Update-Fenster getrennt, damit sich beide nicht gegenseitig ersetzen.
- `AppUpdates` hält ein Update-Fenster zurück, solange das Neuigkeiten-Fenster offen ist, und zeigt es nach dem Schließen.
- Start: direkt nach `AppUpdates.shared.start()` im App-Start, also vor der ersten automatischen Prüfung nach 10 s.
- `UpdateSettingsView` (in `native/Updates.swift`) bekommt den Knopf „Was ist neu“. Das App-Menü bekommt „Was ist neu …“.
- Fehlt die Datei (Entwicklungs-Build ohne Kopie) oder lässt sie sich nicht lesen: kein Fenster, nichts gespeichert, kein Fehlerdialog. Der Knopf zeigt dann „Keine Änderungsnotizen.“

## 4. Windows

- `package.json` → `build.files` nimmt `CHANGELOG.md` auf. Der Hauptprozess liest sie aus dem App-Verzeichnis (`app.getAppPath()`).
- `desktop/main.cjs` wendet die Regel nach dem Laden des Fensters an, speichert `seenVersion` über den bestehenden `fileStore` und sendet bei Bedarf `pi:whats-new` mit `{version, notes}` an die Oberfläche.
- `desktop/updates.cjs` behält beim Speichern das Feld `seenVersion` bei. Bisher schreibt `persist()` nur `auto`, `skipped` und `lastCheck` und würde es sonst löschen.
- `desktop/preload.cjs` ergänzt `whatsNew.onShow(callback)` und `whatsNew.open()`. Letzteres liefert die letzten zehn Abschnitte für den Knopf.
- `public/features.js` zeigt das Fenster als eigenen Dialog mit der vorhandenen, über DOMPurify gefilterten Markdown-Darstellung des Update-Dialogs. Solange er offen ist, wartet `showUpdate` mit automatisch gefundenen Updates bis zum Schließen.
- Einstellungsseite „Updates“: Knopf „Was ist neu“.
- Fehlt die Datei oder ist sie nicht lesbar: kein Fenster, nichts gespeichert.

## 5. Veröffentlichen

Keine Änderung am Release-Ablauf. Die Release-Skripte verlangen bereits einen Changelog-Abschnitt je Version. Wer eine Version mit größeren Änderungen ausrollt, erhöht die Mittelnummer. Fehlerbehebungen erhöhen nur die letzte Stelle. Beide App-READMEs nennen diese Regel im Abschnitt zum Veröffentlichen.

## 6. Fehlerfälle

| Fall | Verhalten |
|---|---|
| Changelog fehlt oder ist unlesbar | Kein Fenster, nichts speichern; Knopf zeigt „Keine Änderungsnotizen.“ |
| Gespeicherter Wert kaputt | Wie „keine gespeicherte Version“ |
| Kein Abschnitt im Bereich | Kein Fenster, Version merken |
| Update-Dialog und Neuigkeiten gleichzeitig | Neuigkeiten zuerst, Update-Dialog danach |
| Speichern schlägt fehl (Windows-Datei) | Fenster trotzdem zeigen; schlimmstenfalls erscheint es beim nächsten Start erneut |

## 7. Tests

- **Regel, beide Plattformen:** alle Zeilen der Tabelle in Abschnitt 1, außerdem ungültige gespeicherte Werte und die Begrenzung auf zehn Abschnitte beim manuellen Aufruf. Mac über `test/update-logic.test.mjs`, das `UpdateLogic.swift` eigenständig kompiliert. Windows über `test/changelog.test.mjs`.
- **Windows-Speicher:** Test, dass `persist()` das Feld `seenVersion` nicht verliert.
- **Ausgeliefert:** Mac: Test, dass `build.py` die `CHANGELOG.md` kopiert. Windows: Test, dass `build.files` sie enthält.
- **Von Hand:**
  - Mac: Build starten mit `defaults write studio.pidesk.mac whatsNew.seenVersion 0.2.0` → Fenster erscheint einmal. Neustart → kein Fenster. Menü „Was ist neu …“ → Fenster.
  - Windows-Oberfläche auf dem Mac: `seenVersion` in `updates.json` zurücksetzen → Fenster. Ein Windows-Rechner-Lauf ist damit nicht belegt.

## Dateien

- macOS: `native/UpdateLogic.swift`, `native/Updates.swift`, `native/PiDesk.swift` (Menü, Start), `native/build.py`, `test/update-logic.test.mjs`, `test/update-logic-checks.swift`, `README.md`
- Windows: `desktop/changelog.cjs`, `desktop/updates.cjs`, `desktop/main.cjs`, `desktop/preload.cjs`, `public/features.js`, `package.json`, `test/changelog.test.mjs`, `test/updates.test.mjs`, `README.md`
