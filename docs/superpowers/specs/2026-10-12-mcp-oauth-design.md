# OAuth-Anmeldung für MCP-Server – Design

Stand: 12.10.2026 · Status: abgestimmt, noch nicht umgesetzt

## Ziel

HTTP- und SSE-MCP-Server, die OAuth verlangen, lassen sich in Pi Desk per Browser-Anmeldung verbinden. Danach laufen sie dauerhaft, ohne dass jemand Tokens von Hand kopiert. Anlass: Ulrike Stahl kann den AITI-MCP (`https://www.aitraining.institute/mcp`) nicht nutzen; OMP meldet bei jedem Start „MCP tool load failed · HTTP 401“, und „Verbindung testen“ zeigt nur „Verbindung fehlgeschlagen“.

**Erfolgskriterium:** Bei einem Server wie dem AITI-MCP auf „Anmelden“ klicken, im Browser freigeben, danach lädt OMP die Werkzeuge ohne 401 und erneuert den Zugang selbstständig.

## Ausgangslage

**OMP 18.4.10** (Quelle: Tag `v18.4.10`, Commit cb0d529):
- Es bietet keinen Weg, die MCP-Anmeldung außerhalb seiner Terminal-Oberfläche zu starten. Es gibt keinen RPC-Befehl und keinen CLI-Befehl, und `/mcp reauth` ist im RPC-Modus gesperrt (`TUI_ONLY_MCP_VERBS`).
- Gespeicherte Anmeldungen nutzt OMP in **jedem** Modus:
  - Vor jedem Verbindungsaufbau erneuert es Tokens, die in weniger als 5 min ablaufen, und setzt `Authorization: Bearer …`.
  - Bei 401/403 erneuert es und wiederholt die Anfrage einmal.
  - Rotierte Refresh-Tokens schreibt es zurück.
  - Ein endgültig abgelehnter Refresh deaktiviert den Eintrag.
- **Speicher:** `<PI_CODING_AGENT_DIR>/agent.db` (SQLite, WAL), Tabelle `auth_credentials`.
  - Spalten: `id`, `provider`, `credential_type`, `data`, `disabled_cause`, `identity_key`, `created_at`, `updated_at`.
  - Schema-Version 8 in Tabelle `auth_schema_version`.
  - Eintrag: `provider = "mcp_oauth:profile:<OMP_PROFILE oder default>:" + <URL exakt wie in mcp.json>`, `credential_type = "oauth"`, `data` = JSON `{access, refresh, expires (ms), tokenUrl, clientId, clientSecret?, resource?, authorizationUrl}`.
  - OMP findet den Eintrag über die URL. In `mcp.json` ist dafür nichts nötig, solange der Eintrag keinen `Authorization`-Header und kein `auth` mit anderem Typ als `oauth` hat.
- `mcp.json` kennt `oauth: {clientId, clientSecret, scope, redirectUri, callbackPort, callbackPath, prompt}`.

**AITI-MCP** (öffentliche Metadaten geprüft):
- Antwortet mit 401 und `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource/mcp"`.
- Anmeldeserver `https://www.aitraining.institute` mit `registration_endpoint`, PKCE S256, `token_endpoint_auth_methods_supported: ["none"]` und `refresh_token`.
- Scopes `profil:read ausbildung:read`.

## Entscheidungen

| Thema | Entscheidung |
|---|---|
| Weg | Pi Desk führt die Anmeldung selbst durch und legt das Ergebnis im OMP-Format in `agent.db` ab. Bearer-Einsatz und Erneuerung übernimmt OMP. |
| Verworfen | Fester `Authorization`-Header: ohne Erneuerung, Ausfall nach etwa 1 h. OMP-Terminal mit `/mcp reauth`: für Nutzer nicht zumutbar. |
| Ort | Lokale Node-Engine der jeweiligen App (`server.mjs`), Module `mcp-oauth.mjs` und `mcp-credentials.mjs` je App. Kein gemeinsames Modul (AGENTS.md). |
| SQLite | `node:sqlite` (Mac-Engine Node 24.18, Windows-Electron Node 24.21). |
| Erweiterte Anmeldung | Optional Client-ID, Client-Geheimnis, Scopes, fester Rückleitungs-Port. Leer bedeutet automatisch. |
| mcp-remote | Erkennen und Umstellung auf HTTP mit Pi-Desk-Anmeldung anbieten. |
| Upstream | Anregung bei OMP (RPC-Befehl für MCP-Anmeldung) nur nach Liams Freigabe. Gibt es ihn, kann Pi Desk umsteigen. |

## 1. Verhalten für Nutzer (beide Plattformen)

**MCP-Liste** – nur HTTP- und SSE-Server:

| Zustand | Statuszeile | Knöpfe |
|---|---|---|
| Gültige Anmeldung | „Angemeldet“ | „Abmelden“ |
| Eintrag von OMP deaktiviert | „Anmeldung abgelaufen“ | „Neu anmelden“ |
| Keine Anmeldung, letzter Test ergab 401 | „Anmeldung erforderlich“ | „Anmelden“ |
| Keine Anmeldung, sonst | – | „Anmelden“ |

Lokale Programme (stdio) zeigen nichts davon. Ausnahme ist mcp-remote (Abschnitt 5).

**Anmelden**
1. Klick auf „Anmelden“ bzw. „Neu anmelden“.
2. Pi Desk liest die Metadaten und registriert sich, sofern keine Client-ID eingetragen ist.
3. Der Standardbrowser öffnet die Anmeldeseite.
4. In Pi Desk erscheint ein Hinweis „Anmeldung im Browser abschließen“ mit dem Servernamen, „Link kopieren“ und „Abbrechen“.
5. Nach der Freigabe zeigt der Browser eine schlichte deutsche Seite „Anmeldung abgeschlossen. Du kannst dieses Fenster schließen.“ Pi Desk zeigt „Angemeldet“.
6. Übernahme in Chats wie in Abschnitt 4.

- Nach 5 Minuten oder bei „Abbrechen“: abbrechen, nichts speichern.
- Es läuft immer nur eine Anmeldung gleichzeitig. Ein zweiter Klick zeigt die laufende.
- Anmelden geht auch, wenn der Server noch nicht für Agenten aktiviert ist.

**Fehlermeldungen** (deutsch, mit Grund):

| Ursache | Meldung |
|---|---|
| Server ohne 401 | „Dieser Server verlangt keine Anmeldung.“ |
| Metadaten fehlen oder sind ungültig | „Der Server nennt keinen gültigen Anmeldeserver.“ |
| Server nicht erreichbar | „Server nicht erreichbar: <Grund>“ |
| Registrierung abgelehnt oder nicht angeboten | „Dieser Server verlangt eine registrierte App. Trage unter ‚Erweiterte Anmeldung‘ eine Client-ID ein.“ |
| Fester Port belegt | „Der Rückleitungs-Port <n> ist belegt. Beende das Programm, das ihn nutzt, oder wähle einen anderen Port, der beim Anbieter eingetragen ist.“ |
| Ablehnung im Browser (`error=…`) | „Anmeldung im Browser abgelehnt: <error_description oder error>“ |
| Falscher `state` | Wird ignoriert; der Empfänger wartet weiter auf die richtige Rückleitung. |
| Token-Tausch scheitert | „Der Anmeldeserver hat die Anmeldung nicht bestätigt: <Grund>“ |
| `agent.db` passt nicht | „Diese OMP-Version speichert Anmeldungen anders. Bitte Pi Desk aktualisieren.“ |

**Verbindung testen**
- Der Test nutzt die echte Anmeldung (Abschnitt 4).
- Bei 401 oder 403 meldet er „Anmeldung erforderlich“ und setzt den Status der Liste auf „Anmeldung erforderlich“, bis zur Anmeldung oder einer Änderung des Servers.

**Abmelden, Entfernen, URL ändern**
- „Abmelden“ löscht alle Einträge dieser URL (aktiv und deaktiviert) und übernimmt die Änderung wie in Abschnitt 4.
- „Server entfernen“ löscht seine Einträge mit.
- Eine geänderte URL löscht die Einträge der alten URL. Der Server steht danach ohne Anmeldung da.

**Erweiterte Anmeldung** (ausklappbarer Bereich im Server-Dialog, nur HTTP/SSE)
- Felder: Client-ID, Client-Geheimnis, Scopes (durch Leerzeichen getrennt), Rückleitungs-Port.
- Darunter die genaue Rückleitungsadresse zum Kopieren: `http://127.0.0.1:<Port>/callback`. Sie wird beim Anbieter eingetragen.
- Port-Regel: Ohne Port nutzt Pi Desk einen freien zufälligen Port. Mit Client-ID ohne Port weist Pi Desk darauf hin, dass registrierte Apps meist einen festen Port brauchen, lässt die Anmeldung aber zu.
- Das Geheimnis wird nie zurückgezeigt; wie bei Headern bleibt es bei leerem Feld erhalten und lässt sich ausdrücklich entfernen.

## 2. Anmeldeablauf (`mcp-oauth.mjs`)

Reine Funktionen und eine Sitzung. Netzwerk (`fetch`), Zeit, Zufall und das Öffnen von Ports werden übergeben, damit Tests sie ersetzen können.

1. **Challenge holen**
   - POST einer MCP-`initialize`-Anfrage an die Server-URL, mit den Headern des Eintrags außer `Authorization`.
   - Bei 2xx: Fehler „verlangt keine Anmeldung“.
   - Bei 401/403: `WWW-Authenticate` lesen (`resource_metadata`, `scope`).
2. **Protected Resource Metadata**
   - Ohne `resource_metadata` die RFC-9728-Adresse `<origin>/.well-known/oauth-protected-resource<pfad>`, danach ohne Pfad.
   - Daraus `authorization_servers[0]`, `scopes_supported`, `resource`.
3. **Anmeldeserver-Metadaten**
   - Reihenfolge: `<as-origin>/.well-known/oauth-authorization-server<as-pfad>`, dann `<as-origin>/.well-known/openid-configuration<as-pfad>`, dann `<as>/.well-known/openid-configuration`.
   - `issuer` muss der Anmeldeserver-Adresse entsprechen (ohne abschließenden Schrägstrich verglichen).
   - Pflicht: `authorization_endpoint`, `token_endpoint`.
   - Unterstützt der Server `code_challenge_methods_supported`, muss `S256` enthalten sein.
4. **Scopes:** Erweiterte Anmeldung, sonst `scope` aus der Challenge, sonst `scopes_supported` der Resource-Metadaten, sonst kein `scope`.
5. **Rückleitungsempfänger**
   - `http.createServer` nur auf `127.0.0.1`, Port aus der Erweiterten Anmeldung oder 0 (zufällig), Pfad `/callback`.
   - `redirect_uri = http://127.0.0.1:<port>/callback`.
   - Andere Pfade: 404.
6. **Client**
   - Mit Client-ID: diese nutzen.
   - Sonst Registrierung an `registration_endpoint` mit `{client_name:"Pi Desk", redirect_uris:[redirect_uri], grant_types:["authorization_code","refresh_token"], response_types:["code"], token_endpoint_auth_method:"none", application_type:"native", scope?}`.
   - Ohne `registration_endpoint` oder bei 4xx: Fehler „verlangt eine registrierte App“.
7. **Autorisierungs-Adresse**
   - Parameter: `response_type=code`, `client_id`, `redirect_uri`, `code_challenge` (S256 über 32 Zufallsbytes, base64url), `code_challenge_method=S256`, `state` (16 Zufallsbytes, hex), `scope?`, `resource` (aus den Metadaten, sonst die Server-URL).
   - Pi Desk gibt diese Adresse an die Oberfläche, die den Browser öffnet.
8. **Rückleitung**
   - Mit passendem `state`: bei `error` Abbruch mit Meldung, bei `code` weiter.
   - Der Browser bekommt eine kleine HTML-Seite (dunkel, deutsch), danach wird der Empfänger geschlossen.
9. **Token-Tausch**
   - POST form-urlencoded an `token_endpoint`: `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`, `code_verifier`, `resource`, `client_secret?`.
   - Ohne `access_token`: Fehler.
   - `expires = jetzt + (expires_in ?? 3600) * 1000`, `refresh = refresh_token ?? ""`.
10. **Ergebnis:** `{access, refresh, expires, tokenUrl, clientId, clientSecret?, resource?, authorizationUrl}`.

**Zeitgrenzen:** jede Metadaten- und Registrierungsanfrage 10 s, die gesamte Sitzung 5 min. Abbruch schließt den Empfänger sofort.

## 3. Speichern (`mcp-credentials.mjs`)

- Öffnet `<Daten>/agent/agent.db` mit `node:sqlite`, `PRAGMA busy_timeout = 5000`.
- **Prüfung vor jedem Schreiben:**
  - Tabelle `auth_credentials` mit den Spalten `provider`, `credential_type`, `data`, `disabled_cause`, `updated_at` vorhanden.
  - `auth_schema_version` enthält 8.
  - Sonst Fehler „Diese OMP-Version speichert Anmeldungen anders“.
- **Fehlt `agent.db`:** Die Engine startet ihren Anmelde-Worker einmal (OMP legt die Datei an) und versucht es danach erneut.
- **Schlüssel:** `mcp_oauth:profile:${process.env.OMP_PROFILE || 'default'}:${url}`. `url` exakt so, wie sie in `mcp.json` steht.
- **Funktionen**
  - `status(url)` → `signed-in` (aktiver Eintrag), `expired` (nur deaktivierte Einträge), `none`.
  - `save(url, credential)`: in einer Transaktion bisherige aktive Einträge mit `disabled_cause = 'replaced by newer credential'` und aktuellem `updated_at` markieren, dann neuen Eintrag mit `credential_type = 'oauth'` einfügen.
  - `remove(url)`: alle Einträge des Schlüssels löschen.
  - `snapshot(targetDir)`: `VACUUM INTO '<targetDir>/agent.db'` für den Verbindungstest.
  - Lesen ohne Datei oder ohne Tabelle → `none`, kein Fehler.

## 4. Engine (`server.mjs`, `capabilities.mjs`) je App

**Routen** (POST, mit den bestehenden Schutzprüfungen der Engine):

| Route | Wirkung |
|---|---|
| `capabilities/mcp-login {name}` | Startet die Sitzung, liefert `{id, url}`. Läuft schon eine, liefert sie diese. |
| `capabilities/mcp-login-status {id}` | `{state: waiting/done/failed/cancelled, error?}` |
| `capabilities/mcp-login-cancel {id}` | Bricht ab. |
| `capabilities/mcp-logout {name}` | `remove(url)`, danach Übernahme. |
| `capabilities/mcp-convert-remote {name}` | mcp-remote-Eintrag auf HTTP umstellen (Abschnitt 5). |

**Serverliste** (`servers()`)
- Neu: `login` (`signed-in`/`expired`/`required`/`none`; `required` aus dem letzten Test, im Speicher der Engine) und `oauth` (Client-ID, Scopes, Port; `hasClientSecret` statt Geheimnis).
- `hasOAuth` bleibt für bestehende `auth`-Blöcke.

**Speichern eines Servers** (`saveServer`)
- Übernimmt `oauth` aus dem Dialog in das OMP-Format. Leeres Geheimnis behält das gespeicherte, `clearSecrets` entfernt es.
- Löscht bei geänderter URL die Anmeldung der alten. `setServer(remove)` löscht die Anmeldung.

**Übernahme in Chats** (nach Anmelden und Abmelden)
- Ruhende Worker beenden (`intentional = true`, `rpc.close()`, aus `workers` entfernen). Sie starten beim nächsten Gebrauch mit der Anmeldung neu.
- Laufende Worker (`busy` oder offene Anfragen) bekommen `reloadWhenIdle = true`. Wird ein solcher Worker frei (Ende der Aufgabe, keine offenen Anfragen), beendet die Engine ihn auf dieselbe Weise.
- Der Anmelde-Worker wird ebenfalls neu gestartet.
- Die Oberfläche bekommt `settings_updated`.
- Andere MCP-Änderungen verhalten sich weiter wie bisher.

**Verbindungstest** (`probe`)
- Vor dem Start der Test-OMP `snapshot()` in das Testverzeichnis, sofern `agent.db` existiert.
- 401/403 im Ergebnis → Fehler „Anmeldung erforderlich. Mit „Anmelden“ im Browser anmelden.“ und Status `required` merken. Erfolg löscht `required`.

## 5. mcp-remote

- **Erkennung** bei stdio-Einträgen:
  - `command` endet auf `npx`, `bunx`, `pnpm` (mit `dlx`) oder `mcp-remote`.
  - In `args` steht `mcp-remote` oder `mcp-remote@<version>` (bei `command` = `mcp-remote` entfällt das).
  - Danach folgt eine `http(s)`-URL.
- **Anzeige:** Statuszeile „Verwendet mcp-remote mit eigener Anmeldung“ und Knopf „Als HTTP-Server mit Pi-Desk-Anmeldung einrichten“.
- **Umstellung nach Bestätigung**
  - Ersetzt den Eintrag durch `{type:"http", url}`.
  - `--header "Name: Wert"`- bzw. `--header Name:Wert`-Argumente werden zu `headers`.
  - Andere Argumente nennt die Bestätigung als „werden nicht übernommen“.
  - Name, Aktivierung und `env` bleiben.
  - Danach ist der Server ohne Anmeldung und zeigt „Anmelden“.
- `~/.mcp-auth` wird nicht angefasst.

## 6. Oberfläche

**macOS** (`native/Capabilities.swift`)
- Zeilen der MCP-Liste mit Statuszeile und Knöpfen nach Abschnitt 1.
- Anmeldeblatt mit Statuspolling (1 s), „Link kopieren“ und „Abbrechen“. Der Browser öffnet sich über `desk.open(url)`.
- `MCPSettingsEditor` mit einer `DisclosureGroup` „Erweiterte Anmeldung“.
- mcp-remote-Knopf mit Bestätigungsdialog.
- Quiet Studio Dark wie bestehende Blätter.

**Windows** (`public/features.js`)
- Dasselbe mit `contentDialog`, Statuspolling und `details` „Erweiterte Anmeldung“ im Formular.
- Der Browser öffnet sich über den bestehenden Weg für externe Links (`window.open` → `openExternal` im Hauptprozess, nur `http`/`https`).

## 7. Tests

**Unit, je App** (`test/mcp-oauth.test.mjs`, `test/mcp-credentials.test.mjs`)
- Lokaler Testserver (Node `http`) mit MCP-401 + Challenge, Resource-Metadaten, Anmeldeserver-Metadaten, Registrierung, Authorize (leitet sofort auf die Rückleitung um) und Token.
- Fälle:
  - erfolgreiche Anmeldung mit Registrierung
  - mit fester Client-ID und festem Port (keine Registrierung, `client_secret` im Token-Tausch)
  - Server ohne 401
  - fehlende Metadaten
  - Issuer passt nicht
  - Registrierung abgelehnt
  - belegter Port
  - `error=access_denied`
  - falscher `state` (ignoriert, danach richtiger)
  - Token-Tausch ohne `access_token`
  - Zeitüberschreitung (mit übergebener Uhr)
  - Abbruch
  - Scopes-Reihenfolge
  - `resource`-Rückfall
- Speicher gegen eine `agent.db`, die die echte OMP 18.4.10 angelegt hat (einmal erzeugt im Test über einen kurzen OMP-Start mit isoliertem `PI_CODING_AGENT_DIR`):
  - `save` ersetzt und markiert
  - `status` für alle drei Zustände
  - `remove`
  - `snapshot`
  - Schema-Prüfung schlägt bei fremder Version an
- mcp-remote-Erkennung und -Umwandlung: `npx -y mcp-remote URL`, `mcp-remote@0.1 URL --header …`, kein Treffer bei anderen Paketen.

**Kompatibilität mit echter OMP** (`test/mcp-oauth-smoke.mjs`, je App; Windows mit `PI_DESK_OMP` auf die Mac-Runtime)
- Testserver mit OAuth und MCP, der nur mit gültigem Bearer Werkzeuge liefert.
- Anmeldung über `mcp-oauth.mjs`, `save()`, dann:
  - `omp token <schlüssel>` liefert den Access-Token.
  - Eine OMP-Probe mit `snapshot()` lädt die Werkzeuge ohne 401.
  - Mit abgelaufenem `expires` erneuert OMP über den Refresh-Token; der Testserver sieht `grant_type=refresh_token`.
- Dieser Test gehört zur Prüfliste beim Anheben der OMP-Version (README beider Apps).

**Oberfläche:** Windows über Electron mit DevTools-Protokoll auf dem Mac. macOS von Hand. Ein Lauf auf einem Windows-Rechner bleibt offen und wird in `WINDOWS-TESTPLAN.md` aufgenommen.

## 8. Doku

- READMEs beider Apps:
  - Abschnitt MCP um Anmeldung, Erweiterte Anmeldung und mcp-remote ergänzen.
  - Den Satz „Neue OAuth-Anmeldungen sind noch nicht angebunden“ entfernen.
  - Den Smoke-Test als Pflicht beim OMP-Update aufnehmen.
- `FEATURE-PARITY.md` (macOS): MCP-Zeile aktualisieren.
- `WINDOWS-TESTPLAN.md`: Schritte für die Anmeldung auf einem echten Windows-Rechner.
- Hinweis im Editor „Neue OAuth-Anmeldungen sind hier noch nicht verfügbar“ entfernen.

## Dateien

- **macOS:** `mcp-oauth.mjs` (neu), `mcp-credentials.mjs` (neu), `capabilities.mjs`, `server.mjs`, `native/Capabilities.swift`, `native/build.py` (neue Module in `host` kopieren), `test/mcp-oauth.test.mjs` (neu), `test/mcp-credentials.test.mjs` (neu), `test/mcp-oauth-smoke.mjs` (neu), `README.md`, `FEATURE-PARITY.md`, `VERIFICATION.md`
- **Windows:** `mcp-oauth.mjs` (neu), `mcp-credentials.mjs` (neu), `capabilities.mjs`, `server.mjs`, `public/features.js`, `package.json` (Testliste; `*.mjs` ist bereits in `build.files`), `test/mcp-oauth.test.mjs` (neu), `test/mcp-credentials.test.mjs` (neu), `test/mcp-oauth-smoke.mjs` (neu), `README.md`, `WINDOWS-TESTPLAN.md`, `VERIFICATION.md`
