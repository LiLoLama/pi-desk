# Verification · 2026-09-16

## Verified

- Official macOS arm64 OMP 18.2.1 binary: SHA-256 matches GitHub release digest.
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
- `capabilities-smoke.mjs` passes against real bundled OMP 18.2.1 and isolated local fixtures: skill command and description loaded into model context; MCP initialize/list; deferred xd:// route visible; approval prompt before MCP call; result reaches model/chat; pending-work config changes rejected; disabling removes skills/tools after reload; state and session survive restart. No external inference or user credentials used.
- `mcp-transports-smoke.mjs` passes for real OMP HTTP and SSE initialize/list with authorization headers. Neither connection test executes a tool. stdio tool execution is covered by the previous integration test.
- Integration found two implementation issues and fixed them: diagnostic workers require an explicit model identity even without inference; OMP exposes deferred MCP tools through live system-prompt xd:// routes rather than dumpTools. Live route parsing is version-specific to pinned OMP 18.2.1 and covered by the integration test.
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

## Release-Paket vom 29.09.2026

Neu gebaut: `Pi-Desk-0.1.0-apple-silicon.dmg` (146612103 Bytes). SHA-256: `38c82f48d570f3e55c693ff128bdac89e8cc871c7e4ae8fab63625279fcc7f99`. 13 Tests, neuer nativer Build, strikte tiefe Signaturprüfung und DMG-Integritätsprüfung bestanden. Ad-hoc signiert, nicht notarisiert.
