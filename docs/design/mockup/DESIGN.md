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

Bestätigte Richtung aus der Unterhaltung vom 16.09.2026. Referenz: ../explorations/06-quiet-studio-dark.png. Die spätere Nutzerkorrektur hat Vorrang: Container konsequent reduzieren, keine neue Bildgenerierung.

- Drei Flächen: schmale Projektnavigation, freies Gespräch, zuschaltbares Ergebnis.
- Warmes Graphit, leicht abgesetzte Navigation, cremeweißes Primärtext, Salbei ausschließlich für Status. Systemschrift passend zum Mac-Interface.
- Eigene Nachrichten rechts in dezenten Blasen; Agentenantworten links als freier Text ohne Namen. Keine Agentenkarten oder umrahmten Dateilisten. Struktur durch Abstand und Ausrichtung. Einfassungen für Composer, Popover und Vorschau erlaubt.
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
- **Composer:** freies Textfeld mit 13px, transparentem Feldhintergrund und sanfter Fokuslinie auf dem gemeinsamen Composer. Die Sendeaktion ist ohne Text deaktiviert; während einer Demo-Antwort wird sie zum Stoppen verwendet.
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
