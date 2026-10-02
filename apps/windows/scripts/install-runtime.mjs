import {mkdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const base='https://github.com/can1357/oh-my-pi/releases/download/v18.4.10/';
const assets=[
 ['omp-windows-x64.exe','runtime/win32-x64/omp.exe','7232c209641f0cad7e20bdb3a074cdb2fb31ae2aa73d42c491c705d28e0d3895'],
 ['LICENSE','licenses/OMP-LICENSE.txt','16c45f9d667442781f03fa198914cc39abcaa48ec5ed8f644643e554ca2fbf63'],
 ['THIRD-PARTY-NOTICES.txt','licenses/OMP-THIRD-PARTY-NOTICES.txt','d0c2e7c05bb4d755044b13fa560be58d01ab7c980b87892400a979397e569a8b']
];
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const [name,relative,sha] of assets){
 const file=path.join(root,relative);
 if(await readFile(file).then(b=>hash(b)===sha).catch(()=>false)){console.log(name+': geprüft');continue;}
 console.log(name+': Download …');
 const response=await fetch(base+name,{signal:AbortSignal.timeout(300000)});
 if(!response.ok)throw Error(`Download ${name}: HTTP ${response.status}`);
 const bytes=Buffer.from(await response.arrayBuffer());
 if(hash(bytes)!==sha)throw Error(`Prüfsumme für ${name} stimmt nicht. Datei verworfen.`);
 await mkdir(path.dirname(file),{recursive:true});
 await writeFile(file+'.download',bytes);await rm(file,{force:true});await rename(file+'.download',file);
 console.log(name+': SHA-256 bestätigt');
}
