# Pi Desk für macOS – Änderungen

## 0.6.0 – 15.10.2026

- Projekte lassen sich per Rechtsklick umbenennen. Nur der Name in Pi Desk ändert sich, der Ordner bleibt, wie er ist. „Ordnernamen verwenden“ stellt den ursprünglichen Namen wieder her.
- „Aus Pi Desk entfernen …“ räumt ein Projekt aus der Liste. Seine Chats kommen in den Papierkorb, der Ordner auf deinem Mac bleibt unverändert. Wer einen dieser Chats wiederherstellt oder den Ordner erneut öffnet, bekommt das Projekt zurück.
- Wurde ein Projektordner verschoben oder umbenannt, ordnet „Ordner neu zuordnen …“ ihn wieder zu. Die Chats bleiben erhalten, statt dass ein zweites Projekt entsteht.

## 0.5.0 – 13.10.2026

- MCP-Server mit OAuth-Anmeldung (zum Beispiel der AITI-MCP) lassen sich jetzt verbinden: In den Einstellungen unter „MCP“ auf „Anmelden“ klicken und im Browser freigeben. Pi Desk verlängert den Zugang danach selbst.
- Die Liste zeigt, ob ein Server angemeldet ist, die Anmeldung abgelaufen ist oder eine Anmeldung nötig ist. „Abmelden“ entfernt sie wieder.
- „Verbindung testen“ nutzt die Anmeldung und meldet klar, wenn eine Anmeldung erforderlich ist.
- „Erweiterte Anmeldung“ im Server-Dialog für Anbieter, die eine registrierte App verlangen (Client-ID, Client-Geheimnis, Scopes, fester Rückleitungs-Port).
- Einträge mit `mcp-remote` lassen sich auf einen HTTP-Server mit Pi-Desk-Anmeldung umstellen.

## 0.4.0 – 12.10.2026

- Nach Updates mit größeren Neuerungen zeigt Pi Desk beim ersten Start einmal, was neu ist. Reine Fehlerbehebungen bleiben still.
- „Was ist neu“ zeigt den Changelog jederzeit: in den Einstellungen unter „Updates“ und im Menü.

## 0.3.1 – 12.10.2026

- Wurde ein Projektordner verschoben oder umbenannt, nennt Pi Desk jetzt den fehlenden Ordner statt nur „OMP beendet“.

## 0.3.0 – 09.10.2026

- Pi Desk sucht jetzt selbst nach Updates und zeigt vor dem Aktualisieren, was neu ist.
- Neue Einstellungsseite „Updates“: automatische Suche ein- oder ausschalten und jederzeit manuell prüfen.
- Die App ist mit Developer ID signiert und von Apple notariell beglaubigt. Die Gatekeeper-Warnung beim ersten Start entfällt.
- Die Kontextlänge lokaler Modelle ist jetzt je Modell wählbar (Standard 32k) und zeigt den geschätzten Speicherbedarf. Behebt Fehler bei lokalen GGUF-Modellen, deren Kontext bisher fest auf 8k stand.
- MCP-Server lassen sich wieder bearbeiten. Bisher öffnete „Bearbeiten“ ein leeres Formular.
- Downloads lokaler Modelle in den Standardordner scheitern nicht mehr an Ordnern hinter symbolischen Links.
- Wichtig: Diese Version einmalig von Hand installieren. Danach kommen Updates automatisch.

## 0.2.0 – 02.10.2026

- Oh My Pi 18.4.10 integriert.
- Die Agentenaktivität wird während der Arbeit erklärt.

## 0.1.0 – 29.09.2026

- Erste Vorabversion für Apple-Silicon-Macs.
