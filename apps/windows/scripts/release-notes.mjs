// Release text for GitHub, built from the CHANGELOG.md section of the current version.
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {section}=createRequire(import.meta.url)('../desktop/changelog.cjs');
export const releaseNotes=(changelog,version)=>`${section(changelog,version).body}

---
Windows x64. Bei der Installation „Nur für mich“ wählen – dann sind keine Administratorrechte nötig und Updates laufen ohne Rückfrage. Nicht signiert: SmartScreen kann beim ersten Start warnen („Weitere Informationen“ → „Trotzdem ausführen“). Ab dieser Version aktualisiert sich Pi Desk selbst. SHA-256 in SHA256SUMS-windows.txt.`;
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 const {version}=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
 const notes=releaseNotes(await readFile(path.join(root,'CHANGELOG.md'),'utf8'),version)+'\n';
 // Optional output path: node writes UTF-8 without BOM itself, no shell re-encoding
 if(process.argv[2])await writeFile(process.argv[2],notes,'utf8');else process.stdout.write(notes);
}
