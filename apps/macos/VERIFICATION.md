# Verification · 2026-09-16

## 0.3.0 – Updates · 05.10.2026

Automatische Updates über Sparkle 2.10.0 (Archiv-SHA-256 `c2bf58aa8387266ac179357b1415d6f2635f044da8be41042af32425dae6da0c`, per `npm run sparkle` gepinnt) mit eigener SwiftUI-Oberfläche (`SPUUserDriver`), Feed `updates/macos/appcast.xml`, Developer-ID-Signatur mit Hardened Runtime. Die folgenden Abschnitte stammen aus den Prüfläufen der Aufgaben 1 bis 7 auf dem Entwicklungs-Mac. Ein Update-Lauf mit echtem Download und ein Release sind noch nicht erfolgt (siehe „Offen“).

### Nachgewiesen

- `npm test` in `apps/macos`: 21 von 21 Tests bestanden (Stand dieses Abschnitts). Darunter sechs zum Updater: Changelog-Abschnitte und Build-Nummern, Appcast-Einträge mit Version, Hinweisen und Signatur, neue Versionen zuerst und Ablehnen von Duplikaten, Lesen der `sign_update`-Ausgabe, Datumstrenner (Geviertstrich und Bindestrich) sowie die nativen Update-Regeln (Versionsvergleich, Release-Notes-Filter, ersetzbarer Installationsort; Swift-Prüfungen in `test/update-logic-checks.swift`). Die Tests prüfen die Logik und die Skripte, nicht Sparkle selbst.
- Build mit Sparkle: `python3 native/build.py` ohne Warnungen; `Sparkle.framework` in `Contents/Frameworks`, Bindung über `@rpath`. Info.plist enthält `SUFeedURL`, `SUPublicEDKey` (`native/sparkle-public-key.txt`), `CFBundleShortVersionString 0.3.0` und `CFBundleVersion 300`; der ad-hoc-Entwicklungs-Build zusätzlich `PIDeskDevBuild`.
- Dialog gegen einen lokalen Testfeed (`http://127.0.0.1:8899/appcast.xml`, Dev-Build mit isoliertem `PI_DESK_DATA`): Der Feed wurde rund 11 s nach dem Start abgerufen (passt zur Prüfung 10 s nach dem Start). Der Screenshot zeigte „Pi Desk 0.3.1 ist verfügbar“, „Du hast 0.3.0.“, den Changelog im Quiet-Studio-Dark-Design sowie die Knöpfe „Diese Version überspringen“, „Später“ und „Jetzt aktualisieren“. Das App-Menü enthält „Nach Updates suchen …“ direkt nach „Über Pi Desk“ (lesend per Skript geprüft).
- Markdown-Listenpunkte: Im Screenshot standen sie über der Textzeile. Behoben im gemeinsamen Renderer (`native/Markdown.swift`, erste Grundlinie); das wirkt auch auf Listen im Chat. Nach dem Fix nur per Offscreen-Rendering geprüft (Punkte und Nummern links neben dem Text auf einer Grundlinie), nicht erneut im sichtbaren Dialog, weil der Bildschirm gesperrt war.
- Developer-ID-Build (`PI_DESK_SIGN_ID` gesetzt): Signatur der App, von `Autoupdate`, `Updater.app`, `Installer.xpc`, `Downloader.xpc`, `Sparkle.framework` und `node` mit Hardened Runtime (`flags=0x10000(runtime)`), Zeitstempel und Developer-ID-Autorität. `node` trägt die Entitlements `allow-jit` und `allow-unsigned-executable-memory`; `omp` behält die Signatur von Can Boluk. `codesign --verify --deep --strict` bestanden, `PIDeskDevBuild` fehlt wie vorgesehen. `spctl` meldet erwartungsgemäß `rejected, source=Unnotarized Developer ID`, da noch nicht notarisiert.
- Laufzeit unter Hardened Runtime: `node` führt dynamischen Code aus (JIT, Ergebnis 42), `omp --version` meldet `omp/18.4.10`, die App startete ihren Host, eine OMP-Sitzung wurde über die lokale API geladen (`omp --mode rpc-ui` als Kindprozess). Im Unified Log und bei Absturzberichten keine Codesignatur- oder JIT-Fehler. Ohne Modellanfrage und mit isoliertem Datenordner.
- Release-Skript (`scripts/release.mjs`): geprüft wurden nur Syntax (`node --check`) und der Aufruf ohne Argument (Verwendung, Exit 1) sowie die Hilfsfunktionen über die Tests. `draft` und `publish` wurden nie ausgeführt. Vorabprüfungen im Code: Version noch nicht im Feed, Release-Tag noch nicht vorhanden, Branch `main`, sauberer Arbeitsbaum, `HEAD == origin/main`, kein gesetztes `PI_DESK_TEST_FEED_BUILD`, kein `PIDeskDevBuild` im Build; `publish` prüft Entwurf und DMG-Größe gegen den Feed.

### Offen

- Task 8, Update-Lauf 0.3.0 → 0.3.1 mit echtem DMG: Download, EdDSA-Prüfung, Neustart in die neue Version, Busy-Regel (nur laden und beim Beenden installieren, solange gearbeitet wird), Abweisen eines manipulierten DMG und Hinweis bei App im Disk-Image. Dieser Lauf hat nicht stattgefunden.
- Interaktive Klickpfade des Dialogs und der Einstellungen: „Später“, „Diese Version überspringen“, Menüpunkt „Nach Updates suchen …“, Einstellungen → Updates (Version, letzte Prüfung, Schalter), „… ist aktuell“, Fehlerdialog mit „Erneut versuchen“ und der Ortshinweis. Der Dialog-Screenshot entstand vor den Korrekturen der Review-Runden und ist bei entsperrtem Bildschirm zu wiederholen.
- Doppelte Beenden-Rückfrage: Ob nach „Jetzt neu starten“ bei laufender Arbeit genau eine Rückfrage erscheint, ist ungeprüft (unbekannt, ob Sparkle `dismissUpdateInstallation` vor dem Beenden aufruft; schlimmstenfalls zweimal fragen, nie ohne Rückfrage).
- Notarisierung und Stapling von App und DMG sowie die `spctl`-Annahme (`source=Notarized Developer ID`) nach der Notarisierung: noch nicht erfolgt. Bis dahin steht hier nur das Ergebnis „Unnotarized Developer ID“.
- Lokale GGUF-Engine (llama.cpp) unter Hardened Runtime: nicht gestartet, ob sie ohne weitere Entitlements läuft, ist ungeprüft.
- Entwurfs-Release `macos-v0.3.0`, Download des Entwurfs und Start ohne Gatekeeper-Warnung: nicht erfolgt. Auch der erste echte Lauf von `release:draft` und `release:publish`, die Rückfrage vor dem Veröffentlichen und das Verhalten von `gh` (unter anderem `--prerelease` bleibt nach `publish` gesetzt) stehen aus.
- Update über den echten GitHub-Feed: erst möglich, wenn 0.3.0 veröffentlicht ist und eine spätere Version (0.3.1) im Feed steht. Bis dahin lief der Updater nur gegen lokale Testfeeds.
- Der Dev-Build teilt die Defaults-Domain `studio.pidesk.mac` mit der installierten App; „Diese Version überspringen“ im Dev-Build würde dort `SUSkippedVersion` setzen. Nach Tests die `SU*`-Schlüssel dieser Domain prüfen.

## Verified

- Official macOS arm64 OMP 18.4.10 binary: SHA-256 matches GitHub release digest.
- Node syntax checks for host, transport and browser JS.
- `node --test test/core.test.mjs`: 2 suites passed (RPC v2 chunk reassembly/invalid sequencing/limits; file containment, symlink escapes, binary and oversized context).
- `node test/runtime-smoke.mjs`: real OMP RPC-UI process against deterministic local HTTP/SSE model. A write was blocked before approval, denied without creating a file, then approved in a new session and executed. Session resumed after process restart and preserved user messages. Four local model requests, zero external inference.
- `node test/http-smoke.mjs`: API rejects missing session, missing mutation origin/header and wrong HTTP methods; runtime binary is not served; projects/context/login-provider discovery work; permission mode and renamed task survive host restart.
- Browser: project creation, session startup, composer context selection/removal surface, real directory tree and text file preview. Desktop layout and 390×844 mobile permission menu visually inspected. No browser console errors on confirmation pass.

## Not yet verified with a user account

No external provider login was completed by the agent and no paid/model-subscription inference was sent. OAuth callbacks, provider-specific quotas and model responses require the user's login. The UI displays OMP's actual providers and supports authorization links, input/select/confirm prompts and cancellation.

## Deliberate first-version boundaries

Text source preview, no running web preview. No Developer-ID/notarized distribution, subagent UI or terminal emulator. Chat Markdown is rendered natively as attributed text, not HTML. Tool approvals are not an OS sandbox. Git diff represents the complete working tree, including preexisting changes. Shutdown does not resume an interrupted generation automatically.


## Native macOS acceptance · 2026-09-16

- SwiftUI/AppKit frontend compiled for arm64 macOS 14+, bundled Node and OMP. No WebView or Electron.
- `codesign --verify --deep --strict` passed for the .app bundle.
- Native app launched through macOS and loaded its provider list from its own automatically started engine.
- A separate `studio.pidesk.uitest` bundle, built with `PI_DESK_UI_TEST`, used only `/private/tmp/pi-desk-native-e2e`. A typed message reached real OMP via the native API adapter. Streamed user/assistant messages appeared in the correct alignment. The native approval sheet displayed the exact write path/content; before approval the file did not exist. After clicking “Einmal erlauben”, OMP wrote the file and its contents appeared in the native file preview.
- Native ⌘O opened NSOpenPanel, navigated to the isolated test project, and after the Mac was unlocked the folder selection created and selected a new task successfully.
- Quitting the first build removed its captured native/Node/OMP process IDs. The computer-use tool subsequently reopened a new instance while querying state; the original process IDs were gone.
- `test/native-host.mjs` passed: dynamic loopback port, requests without native token rejected, second engine with the same data rejected, stdin EOF exits cleanly and removes the lock.
- Existing HTTP integration tests passed after native-host changes.
- Final cosmetic changes: matching vector pi mark and empty composer hint. Personal provider login remains uncompleted.

## Native header correction

Removed macOS shared toolbar capsules and the persistent sidebar search field. Verified final native screenshot: one sidebar toggle, free project title, right-aligned search/new/inspector icons. Cmd-K opens and focuses the compact search popover. Sidebar hide/show works. Rebuilt bundle and local deep signature verification passed.

## Composer pointer and hover correction · 2026-09-16

- NSTextView cursor rectangles are restricted to its visible writing area; the controls strip uses an AppKit arrow-cursor tracking region that does not intercept clicks.
- Composer buttons have padded hit areas, subtle hover/pressed backgrounds, disabled-state handling and reduced-motion support.
- Native build and deep signature validation passed. Relaunched app: context, approval and model popovers all opened correctly. Typed and cleared a draft without sending it; inspected the composer layout in the native screenshot.
- Direct hover/cursor visual verification remains limited: the computer-use tool has no native pointer-move API and its drag attempt returned noWindowsAvailable. No claim of a completed pointer-transition visual test.
- Pets integration is staged behind PI_DESK_PETS while this user-requested fix takes priority; not enabled in this build.

## Chat archive and trash · 2026-09-16

- Added persisted archivedAt/deletedAt lifecycle state, active-chat filtering, native context-menu actions and searchable archive/trash with restoration. Archived/trashed tasks cannot start a worker until restored. Existing workers must be idle with no pending UI request before moving a task. No project-file or session-file deletion occurs; permanent purge remains unimplemented.
- Core tests: 2 passed. HTTP integration passed: archive and trash survive host restarts, inactive sessions are rejected, restoration retains the same session path, project-file contents remain unchanged, invalid actions rejected. Test data is temporary; no external inference. Initial sandbox attempt could not start the local host; the permitted rerun passed.
- Native acceptance: created a new empty test task, archived via context menu, observed it in archive, restored it to sidebar; moved the same test task to trash via confirmation and observed its restore action in the trash. No model request sent. The empty test task remains recoverable in trash.
- Final native build and deep signature verification passed; final app relaunched. One build review failed due to reviewer capacity; identical reviewed build succeeded on retry.
- Full OMP parity remains open and tracked in FEATURE-PARITY.md.

## Native settings and local models · 2026-09-16

- Added native Settings scene (gear and Cmd-comma), with Models & Providers, Agent, Appearance and Keyboard Shortcuts. No placeholder panels for unimplemented OMP features.
- SettingsStore validates URL/type/key/model IDs, writes private files atomically with a recovery journal, preserves unrelated YAML provider entries/comments and redacts stored keys in API responses. Endpoint changes cannot silently reuse a saved key. Global personal instructions and thinking flags reach task worker startup. Settings mutations reject busy workers and pending approvals, close idle runtimes and reopen the selected persisted session.
- Unit tests: 3 passed, including YAML preservation, key redaction/retention, invalid URLs/command-like keys, persisted state, journal recovery and malformed-YAML rejection.
- settings-smoke.mjs passed with real OMP and a deterministic local model: Ollama/LM Studio/OpenAI-style list probes, unavailable-server error, automatic model discovery without pinned IDs, saved custom provider selection, approval-gated write, streamed answer, personal-instructions propagation, rejection of settings/archive changes while approval is pending, host restart and resumed conversation. No external inference.
- Existing HTTP lifecycle/archive/trash smoke test passed after the backend change.
- Native acceptance: gear and Cmd-comma open Settings; all four sections rendered; connection editor exposes type, endpoint, secure key and model IDs. Actual local Ollama endpoint returned an empty model list through the native test button; no production connection was saved. LM Studio was tested via the local protocol fixture, not against a running LM Studio installation.
- Shortcut acceptance: assigning Cmd-O to search produced a conflict; assigning Cmd-Shift-K succeeded and opened search from the main window. Reset restored the original defaults.
- Final .app compiled, local deep signature verified and relaunched. Test/production credentials were not entered or printed. Full OMP parity remains incomplete (FEATURE-PARITY.md).

## Sidebar refinement · 2026-09-16

- Replaced static List sections with project disclosure buttons and indented chat rows. Added persisted collapse state, subdued selection/hover, compact header spacing, middle-truncated project names with full-path tooltips and accessible expanded/collapsed values. Existing rename/archive/trash actions remain on chat rows.
- Native build and deep local signature validation passed. No backend behavior changed.
- Live acceptance blocked: after reading the prior Settings window, native computer-use calls timed out repeatedly, including reacquiring Pi Desk by its bundle ID. App inventory still reports Pi Desk running. The new build has not been visually verified or confirmed relaunched.


## Skills and MCP · 2026-09-16

- Native Settings sections added: selected local skill folders, source preview, search, activation/removal; MCP stdio/HTTP/SSE editors, header/env preservation, activation/removal, connection test and live session inspection. New entries default disabled. Original skill folders are never removed.
- Five unit tests pass, covering the existing decoder/context/settings plus skill activation/persistence/source errors/original preservation and MCP secret redaction, target-change protection, private permissions and unrelated config preservation.
- `capabilities-smoke.mjs` passes against real bundled OMP and isolated local fixtures: skill command and description loaded into model context; MCP initialize/list; deferred xd:// route visible; approval prompt before MCP call; result reaches model/chat; pending-work config changes rejected; disabling removes skills/tools after reload; state and session survive restart. No external inference or user credentials used.
- `mcp-transports-smoke.mjs` passes for real OMP HTTP and SSE initialize/list with authorization headers. Neither connection test executes a tool. stdio tool execution is covered by the previous integration test.
- Integration found two implementation issues and fixed them: diagnostic workers require an explicit model identity even without inference; OMP exposes deferred MCP tools through live system-prompt xd:// routes rather than dumpTools. Die Erkennung folgt nun der Route selbst statt versionsspezifischem Begleittext und ist durch den Integrationstest abgedeckt.
- New MCP OAuth login, project overrides, skill repository installation/updates and plugins/hooks are not implemented. Full parity remains open.
- Native build/signature passed. Final visual/click acceptance for the revised sidebar and new Settings panels remains blocked: computer-use now explicitly reports that the Mac is locked. No claim of visual acceptance or successful final relaunch.


## Direct local models · 2026-09-17

- Separated provider accounts/existing server connections from a native Local Models library with On This Mac, Discover and Folders tabs. Removed duplicate add-connection call to action. Multiple folders, suggested existing LM-Studio/HF-cache paths, persisted roots, original-preserving removal, cycle/dedup handling and visible scan errors.
- App-managed runtime start/stop: pinned official llama.cpp b11013 and uv 0.12.15 archives; private mlx-lm 0.31.3 environment. Local-only model paths, authenticated app gateway, bounded GGUF context, explicit chat selection, cleanup on stop/host shutdown. Long installs/downloads are async jobs with cancellation and progress. Runtime configuration changes use the existing all-workers-idle guard.
- Six unit tests passed, including local-library scan, symlink cycle/dedup, recognizable Hugging Face snapshot names, original preservation, RAM-fit classification and job exclusion/cancellation. Existing settings/context/RPC/capabilities checks remain passing.
- `local-host-smoke.mjs`: deterministic process fixture behind the actual managed gateway → real OMP → explicit write approval → file/streamed response; unload rejected while approval pending; stop and host restart preserve sessions and remove stale generated provider credentials. This test uses a fixture engine, not an actual LLM.
- `local-engine-smoke.mjs`: actual managed MLX install, user's existing gpt-oss-20b-MXFP4-Q8 loaded unchanged from LM-Studio model folder, unauthorized gateway request rejected, actual local completion returned. No external inference; installation from official registry sources. Short completion includes model-specific analysis markup; full reasoning rendering remains separate parity work.
- `gguf-engine-smoke.mjs`: actual public SmolLM2-135M-Instruct Q4_K_M download (~105 MB), LFS checksum verified, official llama.cpp installed and started, real local chat completion returned. This small fixture proves execution, not suitability for agent work.
- `local-download-smoke.mjs`: live GGUF and MLX catalog metadata, recommendation candidates, file sizes/checksums; local download integrity, invalid checksum cleanup and oversized-transfer rejection.
- Native initial review observed readable library/provider/folder/results/detail screens at 900×602, but format picker value clipped to ellipsis. Final fix hides its visual label, preserving accessibility. Race guard prevents stale MLX details being applied after format change. Physical RAM display uses 128 GB rather than decimal bytes. Final app built and deep signature checked.
- Existing user's LM-Studio model directory connected through native UI; four MLX models visible. No production model was auto-loaded; engine tests used isolated temporary host data. Full OMP parity is still incomplete.
- Final independent native verdict: ship for the scored fixes. Format values readable after restart; redundant tab label removed; 128 GB RAM shown. Stale-format guard and snapshot naming verified by reviewer code/test inspection. App left on Local Models → On This Mac. Reviewer used actual inline native captures because the available CUA API supplies images inline without a documented file-export method.

## Compact work activity and approval scopes · 2026-09-17

- Consecutive historical tool results now render as one collapsed “Arbeit · n Schritte” disclosure. Current-turn tool results stay inside one animated working disclosure with elapsed time; approval waiting changes that row's label. Agent text and user bubbles keep the established alignment.
- Approval parsing was verified against OMP's actual split request shape, where `Allow tool: write` is the title and path/content are the message. The primary action remains one-time approval; the adjacent options popover exposes chat-wide and global scopes and states the exact tool key.
- Native isolated acceptance used `PI_DESK_UI_TEST`, the deterministic local model fixture and `/private/tmp/pi-desk-native-e2e`. Choosing “Für diesen Chat immer erlauben” created the fixture file, completed the streamed response, collapsed the completed write into one work row and persisted only `write` under `approvalRules.chat.v1.native-task`.
- Remembered approvals also answer requests from background tasks. A rule is stored only after the approval response succeeds. Provider safety prompts and generic confirmations cannot produce a remembered key. Settings exposes the total and clears chat/global rules.
- `node --test test/*.test.mjs`: 6/6 passed. Final arm64 app build and local signature step passed. No external model request or production file mutation was used for this acceptance.

## Modellgedanken und verständliche Agentenaktivität · 2026-10-02

- Die Ursache der leeren Arbeitsansicht war eine unvollständige native Dekodierung: OMP lieferte `thinking`- und `toolCall`-Blöcke bereits in den Assistant-Nachrichten, Pi Desk las dort aber ausschließlich `text`. Die Modellgedanken werden nun erhalten und als „Gedanken des Modells“ aufklappbar dargestellt.
- Der laufende „Agent arbeitet“-Bereich startet geöffnet. Er zeigt aktuelle Gedanken sowie verständliche Werkzeugnamen und – wenn OMP ihn mitsendet – den Zweck des Schritts. Historische Arbeitsblöcke zeigen dieselben Namen, Zweck, Status und Ausgabe.
- Die zuvor nur per Hover-Hilfe erklärten Symbole unter Agentenantworten sind sichtbar mit „Kopieren“ und „Neuer Chat“ beschriftet; eigene Nachrichten zeigen „Kopieren“ und „Bearbeiten“.
- Swift-Typecheck für alle nativen Quellen, 13/13 macOS-Node-Tests, Impeccable-Detektor, nativer arm64-Build und strikte tiefe Codesign-Prüfung bestanden.

## OMP 18.4.10 und RPC-Verträge · 2026-10-02

- Offizielle Apple-Silicon-Runtime auf SHA-256 `23d3f9ab712fe700e80a43dbd1e8159dfea8e106bf717648a49b1bba1ad3e508` aktualisiert; aktuelle Drittanbieterhinweise übernommen.
- Das entfernte `hub` wurde durch `wait` ersetzt. OMP-Queue-Snapshots/-Events, `messageId`, strukturierte Promptfehler und `session_settled` sind angebunden; `agent_end` wird nicht mehr vorschnell als Ende sämtlicher Hintergrundarbeit behandelt.
- Deferred MCP-Routen werden unabhängig vom umgebenden Systemprompt-Text erkannt; das alte und das neue OMP-Format sind kompatibel. `remove_queued_message` entfernt eine noch an OMP übergebene Queue-Nachricht tatsächlich in der Runtime.
- 13/13 Node-Tests sowie Runtime-, HTTP-, Settings- und Capabilities-Smokes liefen mit der echten OMP-18.4.10-Runtime und lokalen Fixtures erfolgreich. Keine externen Anbieteranfragen und keine Nutzerzugangsdaten.

## Release-Paket vom 02.10.2026

Neu gebaut: `Pi-Desk-0.2.0-apple-silicon.dmg` (155.724.006 Bytes). SHA-256: `9d50f2011a1b3bec83be5ad68d821ca19e3f0ffb65f0e822c64b8f1b7685b82d`. 15 Node-Tests, Runtime-/HTTP-/Settings-/Capabilities-Smokes, Swift-Typecheck, nativer Build, strikte tiefe Signaturprüfung, DMG-Integrität und der Inhalt der gemounteten Disk-Image-App wurden geprüft. Ad-hoc signiert, nicht notarisiert.
