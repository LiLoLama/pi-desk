#!/usr/bin/env python3
"""Build a self-contained, locally signed arm64 macOS .app. Install locked build dependencies with npm ci --ignore-scripts first."""
from pathlib import Path
import shutil, subprocess, plistlib, hashlib, os
root=Path(__file__).resolve().parents[1]
app=root/'dist'/'.stage'/'Pi Desk.app'
final=root/'dist'/'Pi Desk.app'
resources=app/'Contents'/'Resources'
macos=app/'Contents'/'MacOS'
for folder in [resources,macos]:folder.mkdir(parents=True,exist_ok=True)

def is_mach_o(path):
  try:
    with open(path,'rb') as f: magic=f.read(4)
  except OSError:
    return False
  return magic in {b'\xcf\xfa\xed\xfe', b'\xfe\xed\xfa\xcf', b'\xca\xfe\xba\xbe', b'\xbe\xba\xfe\xca'}

def resolve_node():
  home=Path.home()
  candidates=[]
  if os.environ.get('PI_DESK_NODE'): candidates.append(Path(os.environ['PI_DESK_NODE']))
  which=shutil.which('node')
  if which: candidates.append(Path(which))
  nvm=home/'.nvm'/'versions'/'node'
  if nvm.is_dir():
    for version in sorted(nvm.iterdir(), reverse=True):
      candidates.append(version/'bin'/'node')
  hermit=home/'.config'/'goose'/'mcp-hermit'/'cache'/'pkg'
  if hermit.is_dir():
    for version in sorted(hermit.glob('node-*/bin/node'), reverse=True):
      candidates.append(version)
  candidates += [Path('/opt/homebrew/bin/node'), Path('/usr/local/bin/node')]
  seen=set()
  for candidate in candidates:
    try: resolved=candidate.resolve()
    except OSError: continue
    if resolved in seen or not resolved.is_file(): continue
    seen.add(resolved)
    if not is_mach_o(resolved) or not os.access(resolved, os.X_OK): continue
    try:
      version=subprocess.check_output([str(resolved),'-v'], text=True, timeout=8).strip()
    except Exception:
      continue
    if not version.startswith('v'): continue
    try: major=int(version[1:].split('.',1)[0])
    except ValueError: continue
    if major<22: continue
    print(f'Bundling Node {version} from {resolved}')
    return resolved
  raise SystemExit('Node.js 22+ Mach-O binary required for building (bundled into the result). Wrapper scripts such as Goose/Hermit shims are rejected. Set PI_DESK_NODE to a real node binary if needed.')

node=resolve_node()
omp=root/'runtime'/'omp'
if hashlib.sha256(omp.read_bytes()).hexdigest()!='ac673868a1598b4beda98dc6ce2148f24afabc42816c702b2dac5f79f0d861de':raise SystemExit('Unexpected OMP runtime checksum')
sources=['PiDesk.swift','Markdown.swift','Pets.swift','Settings.swift','Shortcuts.swift','Sidebar.swift','Capabilities.swift','LocalModels.swift','PetActivity.swift','Extensions.swift']
subprocess.run(['swiftc','-swift-version','5','-parse-as-library','-O','-target','arm64-apple-macosx14.0','-module-cache-path','/private/tmp/pi-desk-swift-cache']+[str(root/'native'/name) for name in sources]+['-o',str(macos/'PiDesk'),'-framework','SwiftUI','-framework','AppKit'],check=True)
shutil.copy2(node,resources/'node')
os.chmod(resources/'node',0o755)
if not is_mach_o(resources/'node'): raise SystemExit('Bundled node is not a Mach-O executable.')
host=resources/'host';host.mkdir(exist_ok=True)
for name in ['server.mjs','rpc.mjs','files.mjs','settings.mjs','capabilities.mjs','local-models.mjs','plugins.mjs','worktrees.mjs','rules.mjs']:shutil.copy2(root/name,host/name)
shutil.copytree(root/'node_modules'/'yaml',host/'node_modules'/'yaml',dirs_exist_ok=True)
shutil.copytree(root/'runtime',host/'runtime',dirs_exist_ok=True)
# Browser assets remain available only to authenticated native requests, not used for native UI.
shutil.copytree(root/'public',host/'public',dirs_exist_ok=True)
shutil.copytree(root/'licenses',resources/'licenses',dirs_exist_ok=True)
iconset=root/'dist'/'AppIcon.iconset';iconset.mkdir(exist_ok=True)
subprocess.run(['swift','-module-cache-path','/private/tmp/pi-desk-swift-cache',str(root/'native'/'Icon.swift'),str(iconset)],check=True)
subprocess.run(['iconutil','-c','icns',str(iconset),'-o',str(resources/'AppIcon.icns')],check=True)
info={'CFBundleName':'Pi Desk','CFBundleDisplayName':'Pi Desk','CFBundleExecutable':'PiDesk','CFBundleIdentifier':'studio.pidesk.mac','CFBundleVersion':'1','CFBundleShortVersionString':'0.1.0','CFBundlePackageType':'APPL','CFBundleIconFile':'AppIcon','LSMinimumSystemVersion':'14.0','NSHighResolutionCapable':True,'NSPrincipalClass':'NSApplication','NSLocalNetworkUsageDescription':'Pi Desk verbindet seine Oberfläche mit der lokalen OMP-Engine auf diesem Mac.','NSAppTransportSecurity':{'NSAllowsLocalNetworking':True}}
with (app/'Contents'/'Info.plist').open('wb') as f:plistlib.dump(info,f)
(resources/'BUILD.txt').write_text('Pi Desk 0.1.0\nSwiftUI / AppKit\nmacOS 14+, Apple Silicon\nOMP 18.2.1\nLocal ad-hoc signature, not notarized.\n')
# Sign app shell and bundled Node; leave the official OMP binary's signature untouched.
subprocess.run(['codesign','--force','--sign','-',str(resources/'node')],check=True)
subprocess.run(['codesign','--force','--sign','-',str(app)],check=True)
subprocess.run(['codesign','--verify','--deep','--strict',str(app)],check=True)
backup=root/'dist'/'.previous-app'
if backup.exists():shutil.rmtree(backup)
if final.exists():final.rename(backup)
app.rename(final)
if backup.exists():shutil.rmtree(backup)
print(final)
