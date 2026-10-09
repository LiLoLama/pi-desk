// Downloads the pinned Sparkle release into vendor/sparkle (not committed) and verifies its checksum.
import {createHash} from 'node:crypto';
import {mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const version = '2.10.0';
const sha256 = 'c2bf58aa8387266ac179357b1415d6f2635f044da8be41042af32425dae6da0c';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'vendor', 'sparkle');
const stamp = path.join(target, 'VERSION');

if ((await readFile(stamp, 'utf8').catch(() => '')).trim() === version) {
  console.log(`Sparkle ${version} vorhanden`);
} else {
  const response = await fetch(`https://github.com/sparkle-project/Sparkle/releases/download/${version}/Sparkle-${version}.tar.xz`);
  if (!response.ok) throw Error(`Sparkle-Download fehlgeschlagen (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== sha256) throw Error('Unerwartete Sparkle-Prüfsumme');
  await rm(target, {recursive: true, force: true});
  await mkdir(target, {recursive: true});
  const archive = path.join(target, 'sparkle.tar.xz');
  await writeFile(archive, bytes);
  if (spawnSync('tar', ['-xf', archive, '-C', target], {stdio: 'inherit'}).status !== 0) throw Error('Sparkle konnte nicht entpackt werden');
  await rm(archive);
  await writeFile(stamp, version + '\n');
  console.log(`Sparkle ${version} → ${path.relative(root, target)}`);
}
