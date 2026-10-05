// Release text for GitHub, built from the CHANGELOG.md section of the current version.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {section}=createRequire(import.meta.url)('../desktop/changelog.cjs');
export const releaseNotes=(changelog,version)=>`${section(changelog,version).body}

---
Windows x64. Setup ohne Administratorrechte. Nicht signiert: SmartScreen kann beim ersten Start warnen („Weitere Informationen“ → „Trotzdem ausführen“). Ab dieser Version aktualisiert sich Pi Desk selbst. SHA-256 in SHA256SUMS-windows.txt.`;
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 const {version}=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
 process.stdout.write(releaseNotes(await readFile(path.join(root,'CHANGELOG.md'),'utf8'),version)+'\n');
}
