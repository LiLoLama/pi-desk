# Pi Desk

Desktop-Oberflächen für Oh My Pi: eine native macOS-App und eine Windows-App auf Electron-Basis.

## Struktur

- [apps/macos](apps/macos/README.md): SwiftUI/AppKit, Apple Silicon, macOS 14+.
- [apps/windows](apps/windows/README.md): Electron, Windows x64, Version 0.2.0.
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

Vorhanden: Windows-ZIP 0.2.0, Mac-App und ein älteres Mac-DMG. Das DMG ist älter als die vorhandene Mac-App und darf nicht als frisch geprüfter Build ausgegeben werden. Der tatsächliche Windows-Lauf bleibt offen; siehe Windows-Testplan.

Das Projekt liegt im privaten GitHub-Repository [LiLoLama/pi-desk](https://github.com/LiLoLama/pi-desk), eingerichtet am 29.09.2026. Zugriff erhalten nur ausdrücklich eingeladene Personen. Fertige GitHub-Releases wurden noch nicht angelegt; Release-Veröffentlichung und Lizenzwahl bleiben separate Schritte. Vorhandene Drittanbieter-Lizenzhinweise bleiben erhalten.
