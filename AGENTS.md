# Pi Desk – Arbeitsregeln

- Dies ist der aktive Entwicklungsort für beide Apps. Nicht im früheren Studio-Workspace-Output weiterentwickeln.
- Vor Änderungen das README und die passenden Prüfberichte in `apps/macos` bzw. `apps/windows` lesen.
- Deutsch kommunizieren. Quiet Studio Dark und die bestehenden Genehmigungsabläufe beibehalten.
- Plattformen getrennt prüfen; macOS-Tests beweisen keinen Windows-Lauf. Keine gemeinsamen Module ohne begründeten, geprüften Umbau erzwingen.
- Builds, node_modules, Runtime-Binaries, Zugangsdaten und Nutzerprofile nicht einchecken. Drittanbieter-Lizenzen erhalten.
- Nur auf ausdrücklichen Auftrag committen, pushen oder Releases veröffentlichen.
- Für Windows-Builds `apps/windows`, für Mac-Builds `apps/macos` als Arbeitsverzeichnis verwenden. Die relative Mac-OMP-Runtime für Windows-Entwicklung liegt unter `../macos/runtime/omp`.
