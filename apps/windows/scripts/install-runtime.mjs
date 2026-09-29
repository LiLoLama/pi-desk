import {mkdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const base='https://github.com/can1357/oh-my-pi/releases/download/v18.2.1/';
const assets=[
 ['omp-windows-x64.exe','runtime/win32-x64/omp.exe','fee52652c7b0b90eb7716b3c6da50ab4d90442505eef1c5349c9428e8d966679'],
 ['LICENSE','licenses/OMP-LICENSE.txt','16c45f9d667442781f03fa198914cc39abcaa48ec5ed8f644643e554ca2fbf63'],
 ['THIRD-PARTY-NOTICES.txt','licenses/OMP-THIRD-PARTY-NOTICES.txt','73c0c20e5b9b3ecedb5d6dbfcdd73905155927f52ae8a4d1d04fedcfacf0626e']
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
