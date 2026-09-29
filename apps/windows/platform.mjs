import path from 'node:path';
import os from 'node:os';
export function dataDirectory(platform=process.platform, env=process.env, home=os.homedir()) {
  if(platform==='win32') return path.win32.join(env.LOCALAPPDATA || path.win32.join(home,'AppData','Local'),'Pi Desk');
  return path.join(home, platform==='darwin'?'Library/Application Support/Pi Desk Windows Dev':'.local/share/pi-desk-windows');
}
export function runtimeBinary(here, platform=process.platform, env=process.env) {
  if(env.PI_DESK_OMP) return env.PI_DESK_OMP;
  return path.join(here,'runtime',platform==='win32'?'win32-x64/omp.exe':'omp');
}
