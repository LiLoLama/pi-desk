---
name: Pi Desk · Quiet Studio Dark
description: Dunkler, reduzierter lokaler Design-Prototyp
colors:
  background: "#1b1d1e"
  sidebar: "#222426"
  foreground: "#eeeFEB"
  muted: "#a5a8a8"
  divider: "#ffffff12"
  hover: "#ffffff09"
  selected: "#ffffff0d"
  status: "#abc7a8"
  removal: "#d7aaa2"
  send-background: "#e7e9e5"
  send-foreground: "#242727"
typography:
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "23px"
    fontWeight: 550
    lineHeight: 1.3
    letterSpacing: "-.035em"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
    lineHeight: 1.6
  code:
    fontFamily: "ui-monospace, SFMono-Regular, monospace"
    fontSize: "11px"
    lineHeight: 2
rounded:
  navigation: "7px"
  icon: "8px"
  popover: "12px"
  composer: "17px"
  circle: "50%"
components:
  button-icon:
    textColor: "{colors.muted}"
    rounded: "{rounded.icon}"
    width: "34px"
    height: "34px"
  button-send:
    backgroundColor: "{colors.send-background}"
    textColor: "{colors.send-foreground}"
    rounded: "{rounded.circle}"
    width: "31px"
    height: "31px"
  navigation-task:
    textColor: "{colors.muted}"
    rounded: "{rounded.navigation}"
    padding: "8px 11px"
  navigation-task-active:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.navigation}"
    padding: "8px 11px"
---

# Quiet Studio · Dark

## Overview

**Creative North Star: "Quiet Studio Dark"**

Bestätigte Richtung aus der Unterhaltung vom 16.09.2026. Referenz: ../../docs/design/explorations/06-quiet-studio-dark.png. Die spätere Nutzerkorrektur hat Vorrang: Container konsequent reduzieren, keine neue Bildgenerierung.

- Drei Flächen: schmale Projektnavigation, freies Gespräch, zuschaltbares Ergebnis.
- Warmes Graphit, leicht abgesetzte Navigation, cremeweißes Primärtext, Salbei ausschließlich für Status. Systemschrift passend zum Mac-Interface.
- Eigene Nachrichten rechts in dezenten Blasen; Agentenantworten links als freier Text ohne Namen. Unter der Blase bzw. Antwort sitzt eine kleine Aktionszeile (Uhrzeit/Kopieren/Bearbeiten bzw. Kopieren/Fortfahren), ohne Karten. Keine Agentenkarten oder umrahmten Dateilisten. Struktur durch Abstand und Ausrichtung. Einfassungen für Composer, Popover und Vorschau erlaubt.
- Icons in einheitlicher SVG-Linienstärke; jede Icon-Aktion besitzt zugänglichen Namen und Tooltip. Namen von Projekten, Dateien und Aufgaben bleiben Text.
- Glaswirkung nur an Composer und Popover, keine dekorativen Leuchteffekte.
- Tastaturfokus klar sichtbar. Weniger Bewegung bei prefers-reduced-motion.

## Colors

Graphit und Cremeweiß tragen die Oberfläche. Salbei markiert Status, positive Änderungen und Tastaturfokus; gedämpftes Rot markiert entfernte Diff-Zeilen. Navigation, Hover und Auswahl unterscheiden sich durch leichte Tonwerte, nicht durch Kartenrahmen. Die helle Buchungsvorschau hat eine eigene illustrative Website-Palette; sie ist kein zweites Pi-Desk-Theme.

## Typography

Die Systemschrift hält die App nah am Mac-Interface. Aufgabentitel verwenden die Rolle `title`; auf Mobilgeräten sinken sie auf 22px. Gesprächsinhalt verwendet 14px bei 1.85 Zeilenhöhe und maximal 65ch, mobil 13px. Navigation und Dateizeilen bleiben kompakt (11–12px), Metadaten bei 10–11px. Monospace gehört in Diff und Änderungszahlen. Georgia ist ausschließlich Teil der eingebetteten Website-Vorschau.

## Layout

Die App füllt 100dvh. Navigation, Gespräch und Ergebnis bilden die drei Arbeitsflächen. Die Sidebar misst regulär 218px, bis 1150px 185px und ab 1600px 240px. Der Inhaltsbereich teilt sich regulär in `minmax(400px,1.05fr) minmax(360px,1fr)`. Gespräch und Ergebnis scrollen separat; Composer und Werkzeugleisten bleiben erreichbar.

Bis 900px wechseln Gespräch und Ergebnis innerhalb derselben Fläche. Bis 600px öffnet die Navigation als 235px breites Overlay. Die mobile Gesprächsfläche hat 23px seitlichen Abstand, der Composer 17px. Desktop-Abstände passen sich an die Breite an; keine künstliche globale Abstandsskala ergänzen.

## Elevation & Depth

Arbeitsflächen bleiben offen; Navigation und Composer erhalten eine subtile materialartige Tiefe. Feine Trennlinien und leicht abgesetzte Navigation liefern Orientierung. Composer und Popover verwenden zurückhaltende Transparenz, Blur und Schatten. Suche und mobile Sidebar werden funktional angehoben. Exakte Schatten, Blur und Übergänge stehen im Sidecar; Feine gerichtete Lichtkanten am Composer sind seit der Nutzerkorrektur gewünscht; keine flächigen Leuchteffekte.

## Shapes

Kleine Radien gehören an interaktive Ziele, nicht an neue Inhaltscontainer. Der Composer ist stärker gerundet, der Sendeknopf kreisförmig. SVG-Icons verwenden grundsätzlich 19px, Strichstärke 1.55 und runde Enden. Inhalte stehen frei; Vorschau, Composer und temporäre Overlays bilden begründete Einfassungen.

## Components

- **Icon-Aktionen:** neutrale Grundfarbe, heller bei Hover, dezenter Hintergrund für gedrückte Zustände. Zugänglicher Name erforderlich; Tooltips ergänzen die Orientierung.
- **Navigation:** Projekt- und Aufgabennamen bleiben Text. Aktive Aufgaben erhalten einen sanften Hintergrund und einen kleinen Statuspunkt.
- **Composer:** freies Textfeld mit 13px, transparentem Feldhintergrund und sanfter Fokuslinie auf dem gemeinsamen Composer. Die Sendeaktion ist ohne Text deaktiviert. Während der Arbeit bleibt Senden der Pfeil (Warteschlange); Stopp sitzt daneben. Wartende Nachrichten stehen als kurze Zeilen über dem Feld, ohne Karten.
- **Ergebnis-Tabs:** Icon-Reiter mit heller Unterstreichung für die Auswahl. Pfeiltasten wechseln zwischen Vorschau, Änderungen und Dateien.
- **Dateizeilen und Agenten:** frei angeordnet, ohne Kartenrahmen. Dateinamen öffnen den Beispiel-Diff; Agentensymbole klappen kurze Demo-Details auf.
- **Fokus und Bewegung:** normale Bedienelemente erhalten eine 2px Salbei-Kontur mit 4px Abstand. Button-Übergänge dauern .16s; Toasts .2s. `prefers-reduced-motion` deaktiviert Animationen und Übergänge.

## Do's and Don'ts

- **Do** Raum, Ausrichtung, Typografie und feine Trennlinien zur Gliederung verwenden.
- **Do** Projekt-, Aufgaben- und Dateinamen als Text erhalten und Icon-Aktionen zugänglich benennen.
- **Do** Beispielzustände als lokale Demo kenntlich machen.
- **Don't** Boxen in Boxen, Blasen für Agentenantworten, Agentenkarten oder umrahmte Dateilisten ergänzen.
- **Don't** neue Bilder, dekorative Leuchteffekte oder die Vorschau-Palette als App-Theme einführen.

## Oberflächenvertrag

Operate-Modus. Erste Ansicht zeigt eine bearbeitete Buchungsaufgabe, drei kompakte Agentensymbole, vier geänderte Dateien und eine bedienbare Buchungsvorschau. Aufgabenwechsel, Vorschau/Diff/Dateien, Agentendetails und Composer funktionieren mit Demo-Daten. Kleine Fenster wechseln zwischen Dialog und Ergebnis; Sidebar bleibt zugänglich. Keine Behauptung echter Agentenarbeit.

## Verfeinerung: Gespräch, Kontext und Genehmigungen

- Eigene Beiträge rechts: sanfte Graphitblase, 16px Radius mit 5px Auslauf rechts unten. Agent links: freier Text, keine sichtbaren Rollenlabels oder Avatare.
- Ein einziges „Kontext hinzufügen“ öffnet die Mehrfachauswahl am Composer. Ausgewählte Beispieldateien erscheinen dort als entfernbare Chips. Rechts bleibt für Vorschau, Änderungen und Dateien reserviert; der alte Kontext-Inspektor wurde entfernt.
- Separates Genehmigungsmenü am Composer: Nachfragen, Projektzugriff, Vollzugriff. Auswahl bleibt pro Aufgabe erhalten, nur im Seiten-Arbeitsspeicher. Vollzugriff erhält einen gedämpften warmen Ton. Alle Optionen sind ausdrücklich Demo-Zustände ohne echte Wirkung.
- Premium-Detail: schmale gerichtete Lichtkante und sanfte Tiefenstaffelung des Composers, seidiger Tonwertverlauf in der Sidebar; keine neuen Inhaltscontainer.

## Motion · Quiet momentum

- Fokaler Moment: Beim Senden begleitet eine einmalige 620ms-Lichtbewegung auf der Composer-Kante die eigene Nachricht (420ms, 24px). Agentenantworten erscheinen mit 12px Bewegung und begrenztem 2px Blur, ohne Schreibmaschinen-Effekt.
- Ansichten wechseln in 300ms mit 10px Bewegung, der aktive Tab-Indikator gleitet in 320ms. Aufgabenwechsel 250ms. Kein erneutes Animieren der Historie beim Eintreffen einer Nachricht.
- Menüs öffnen von ihrem Auslöser aus in 280ms; Mehrfachauswahl startet die Menüanimation nicht neu. Kontext-Chips 260ms, Composer gleicht Höhenänderungen über eine transform-basierte FLIP-Bewegung aus.
- Layoutwechsel animieren horizontale Position, nicht Breite. Keine permanente dekorative Animation, keine Ladechoreografie beim Start.
- Web Animations API ohne Abhängigkeiten, unterbrechbare Effekte mit cubic-bezier(.16,1,.3,1). Bei prefers-reduced-motion nur 80ms Transparenzfeedback, keine räumliche Bewegung oder Lichtanimation.

## Functional app · 2026-09-16

This sibling app preserves the approved mockup's visual language and motion. All example projects/messages/file changes are replaced by real OMP state. Onboarding uses a focused provider-login dialog; context stays at the composer. The right pane contains files, text source preview and working-tree diffs. Permission labels now reflect actual OMP policies: Nachfragen / Dateien erlauben / Vollzugriff. These are approvals, not filesystem containment. Runtime boundaries and verified functionality are documented in README.md and VERIFICATION.md.

## Native macOS edition

SwiftUI/AppKit replaces HTML for the shipping .app. Use NavigationSplitView, native toolbar/window chrome, SF Symbols, AppKit text editing and NSOpenPanel. Keep the approved charcoal palette, free agent text, right-aligned user bubbles and single softly lit composer. Context uses a native popover. Provider login uses a native sheet and the system browser only for external OAuth. Respect Reduce Motion. The browser version remains a separate development surface.

### Native header refinement

Suppress macOS 26+ shared toolbar glass backgrounds with the native ToolbarContent API. Remove the default sidebar toggle on the sidebar content (and split-view root) and provide one compact icon. Keep the project title unboxed, align search/new-task/inspector actions right with a flexible native toolbar spacer. Task search opens on demand as a focused popover via the magnifier or Cmd-K, rather than permanently occupying sidebar space. Search does not filter/hide the project sidebar.

### Native settings

Use the system Settings window through the sidebar gear and Cmd-comma. A quiet fixed-width section list leads to plain form rows, dividers and generous spacing. Keep actual editing fields subtly surfaced; no nested decorative cards. Only ship sections with working controls. Model connections use a focused editor with secure key input, explicit test result and save. Native shortcut recording rejects collisions and preserves system commands.

### Project sidebar

Compact branding and project heading; disclosure chevron plus muted folder icon on each project row, with a separate new-task button. Chats are indented 23 pt, use 33 pt minimum hit height, and a neutral translucent selected background instead of the native blue list fill. Persist collapsed project IDs locally. The folder row toggles expansion without changing the active chat. New-task actions expand their project. Preserve chat context menus and accessible button labels/state.

### Native agent activity and approvals

Chat messages render Markdown as native attributed text: cream body, sage links, quiet code blocks, lists and headings without cards. File paths and Markdown file links open the right-hand preview; a context menu reveals the file in Finder. HTTP links still use the system browser.

Consecutive tool results render as one quiet, collapsed “Arbeit · n Schritte” row. Its summary names repeated tools compactly; expansion reveals individual status and output. During a run, current-turn tool results stay inside one animated “Arbeitet” row with elapsed time and an expandable step list. Waiting for approval uses the same row and changes its label instead of adding another chat block. Respect Reduce Motion.

Tool approvals keep “Einmal erlauben” as the primary action. A compact adjacent options button opens chat-wide and global choices, scoped to the named tool. Never remember provider safety checks or generic confirmations. Persist remembered rules locally, apply them to background tasks as well as the selected task, and expose a reset in Agent settings.

### Native local model library

Keep Quiet Studio Dark across `Settings.swift` and `LocalModels.swift`. Provider accounts, existing servers/APIs and the local library have distinct entry points. The server section has one add action and a short empty-state explanation; “Bibliothek öffnen” leads to models Pi Desk runs itself.

Use a native segmented picker for “Auf diesem Mac”, “Entdecken” and “Ordner”. Model and folder lists remain open rows with muted icons, compact metadata and faint dividers, without nested cards. Model names use 13 pt medium text; secondary details use native captions. Loading, downloading and engine setup show progress and a cancel action. Loaded models expose “Entladen” and “Im aktuellen Chat verwenden”.

Discovery pairs search with an accessible MLX/GGUF format picker. Detail views show the source model page, license, download size, GGUF file/quantization where applicable, explicitly estimated memory fit and destination folder before download. The memory label uses binary capacity (128 GB on the reviewed Mac); estimates must never read as a performance guarantee. Multiple folder paths remain readable, with native folder selection and removal clearly described as disconnecting the library entry.

Finish review: **ship** for the scored visual fixes after native inline captures. This records the reviewed presentation, not universal model or inference compatibility.

## Windows-Port 0.3.0

Die Windows-Ausgabe übernimmt Quiet Studio Dark in Electron. Die erweiterte Oberfläche bietet eine seitliche Einstellungsnavigation, kompakte Werkzeuggruppen und explizite werkzeugbezogene Freigaben. Native Windows-Fensterrahmen und Systemdialoge ersetzen AppKit/SwiftUI. MLX und native Pet-Animationen werden nicht als plattformgleiche Funktionen ausgewiesen; unter Windows stehen GGUF über CPU/Vulkan und ein vereinfachter Pi-Begleiter bereit.
