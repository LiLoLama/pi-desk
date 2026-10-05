# Pi Desk

Desktop-Oberflächen für Oh My Pi: eine native macOS-App und eine Windows-App auf Electron-Basis.

## Downloads

- [Windows 0.3.0 – ZIP für x64](https://github.com/LiLoLama/pi-desk/releases/tag/windows-v0.3.0)
- [macOS 0.2.0 – DMG für Apple Silicon](https://github.com/LiLoLama/pi-desk/releases/tag/macos-v0.2.0)

Beide sind Vorabversionen. Windows ist noch nicht auf einem echten Windows-PC verifiziert; macOS ist ad-hoc signiert und nicht notarisiert. Hinweise und Prüfsummen stehen beim jeweiligen Release.

## Struktur

- [apps/macos](apps/macos/README.md): SwiftUI/AppKit, Apple Silicon, macOS 14+.
- [apps/windows](apps/windows/README.md): Electron, Windows x64, Version 0.4.0.
- [docs/design](docs/design/README.md): Designentwürfe und früheres klickbares Mockup.
- [docs/MIGRATION.md](docs/MIGRATION.md): Umzug, Prüfung und Herkunft der Dateien.
- `archive/`: vorhandenes älteres Projekt-ZIP; nur lokal, von Git ausgeschlossen.

Beide Apps bleiben zunächst unabhängig baubar. Gemeinsame Backend-Dateien sind noch nicht zusammengeführt. App-spezifische Anleitungen, Tests und Prüfberichte liegen bei der jeweiligen App.

## Entwicklung

### macOS

```sh
cd apps/macos
npm ci --ignore-scripts
npm test
# Vorhandene Runtime wiederverwenden oder gemäß App-README installieren.
python3 native/build.py
```

### Windows

```sh
cd apps/windows
npm ci
npm test
npm run build:win
```

Entwicklungsstart des Windows-Frontends auf diesem Mac mit der Mac-Runtime:

```sh
cd apps/windows
PI_DESK_OMP="$PWD/../macos/runtime/omp" npm start
```

## Builds und Releases

Build-Ergebnisse bleiben in `apps/macos/dist` bzw. `apps/windows/dist`. Abhängigkeiten, Runtime-Binaries und Builds sind lokal vorhanden, aber von Git ausgeschlossen. Für GitHub werden fertige Pakete als Release-Anhänge veröffentlicht, nicht als Quelldateien eingecheckt.

Die Release-Pakete werden getrennt pro Plattform angeboten. Beide Apps enthalten OMP 18.4.10. Ab macOS 0.3.0 werden Releases mit `npm run release:draft` gebaut, signiert und notarisiert; ab Windows 0.4.0 baut der Workflow „Windows-Release“ auf GitHub das Setup. Die plattformspezifischen Prüfberichte und Release-Hinweise benennen die verbleibenden Grenzen; insbesondere ersetzt ein macOS-Test keinen echten Windows-Lauf.

Update-Feeds liegen unter `updates/` und werden erst beim Ausrollen committet. Ablauf je Plattform im jeweiligen App-README.

Das Repository [LiLoLama/pi-desk](https://github.com/LiLoLama/pi-desk) ist seit 29.09.2026 öffentlich. Drittanbieter-Lizenzhinweise bleiben erhalten. Für den eigenen Pi-Desk-Code ist noch keine allgemeine Open-Source-Lizenz festgelegt; öffentlich sichtbar bedeutet nicht automatisch frei lizenziert.
