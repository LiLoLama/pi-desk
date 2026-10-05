#!/usr/bin/env python3
"""Build a self-contained, locally signed arm64 macOS .app. Install locked build dependencies with npm ci --ignore-scripts first."""
from pathlib import Path
import shutil, subprocess, plistlib, hashlib, os, json, re
root=Path(__file__).resolve().parents[1]
app=root/'dist'/'.stage'/'Pi Desk.app'
final=root/'dist'/'Pi Desk.app'
resources=app/'Contents'/'Resources'
macos=app/'Contents'/'MacOS'
for folder in [resources,macos]:folder.mkdir(parents=True,exist_ok=True)
version=json.loads((root/'package.json').read_text())['version']
if not re.fullmatch(r'^\d+\.\d+\.\d+$',version):raise SystemExit('Version in package.json muss X.Y.Z sein.')
major,minor,patch=(int(part) for part in version.split('.'))
if not (0<=minor<100 and 0<=patch<100): raise SystemExit('Version X.Y.Z mit Y, Z < 100 erforderlich (Build-Nummer).')
build_number=str(major*10000+minor*100+patch)
sign_id=os.environ.get('PI_DESK_SIGN_ID','')
sparkle=root/'vendor'/'sparkle'/'Sparkle.framework'
if not sparkle.is_dir(): raise SystemExit('Sparkle fehlt. Zuerst: npm run sparkle')
public_key=(root/'native'/'sparkle-public-key.txt').read_text().strip()
if len(public_key)<40 or 'PRIVATE' in public_key: raise SystemExit('native/sparkle-public-key.txt enthält keinen öffentlichen Sparkle-Schlüssel.')

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
if hashlib.sha256(omp.read_bytes()).hexdigest()!='23d3f9ab712fe700e80a43dbd1e8159dfea8e106bf717648a49b1bba1ad3e508':raise SystemExit('Unexpected OMP runtime checksum')
sources=['PiDesk.swift','Markdown.swift','Pets.swift','Settings.swift','Shortcuts.swift','Sidebar.swift','Capabilities.swift','LocalModels.swift','PetActivity.swift','UpdateLogic.swift','Extensions.swift']
subprocess.run(['swiftc','-swift-version','5','-parse-as-library','-O','-target','arm64-apple-macosx14.0','-module-cache-path','/private/tmp/pi-desk-swift-cache','-F',str(sparkle.parent)]+[str(root/'native'/name) for name in sources]+['-o',str(macos/'PiDesk'),'-framework','SwiftUI','-framework','AppKit','-framework','Sparkle','-Xlinker','-rpath','-Xlinker','@executable_path/../Frameworks'],check=True)
frameworks=app/'Contents'/'Frameworks';frameworks.mkdir(parents=True,exist_ok=True)
shutil.copytree(sparkle,frameworks/'Sparkle.framework',symlinks=True,dirs_exist_ok=True)
shutil.copy2(node,resources/'node')
os.chmod(resources/'node',0o755)
if not is_mach_o(resources/'node'): raise SystemExit('Bundled node is not a Mach-O executable.')
host=resources/'host';host.mkdir(exist_ok=True)
for name in ['server.mjs','rpc.mjs','rpc-contract.mjs','files.mjs','settings.mjs','capabilities.mjs','local-models.mjs','plugins.mjs','worktrees.mjs','rules.mjs']:shutil.copy2(root/name,host/name)
shutil.copytree(root/'node_modules'/'yaml',host/'node_modules'/'yaml',dirs_exist_ok=True)
shutil.copytree(root/'runtime',host/'runtime',dirs_exist_ok=True)
# Browser assets remain available only to authenticated native requests, not used for native UI.
shutil.copytree(root/'public',host/'public',dirs_exist_ok=True)
shutil.copytree(root/'licenses',resources/'licenses',dirs_exist_ok=True)
iconset=root/'dist'/'AppIcon.iconset';iconset.mkdir(exist_ok=True)
subprocess.run(['swift','-module-cache-path','/private/tmp/pi-desk-swift-cache',str(root/'native'/'Icon.swift'),str(iconset)],check=True)
subprocess.run(['iconutil','-c','icns',str(iconset),'-o',str(resources/'AppIcon.icns')],check=True)
info={'CFBundleName':'Pi Desk','CFBundleDisplayName':'Pi Desk','CFBundleExecutable':'PiDesk','CFBundleIdentifier':'studio.pidesk.mac','CFBundleVersion':build_number,'CFBundleShortVersionString':version,'CFBundlePackageType':'APPL','CFBundleIconFile':'AppIcon','LSMinimumSystemVersion':'14.0','NSHighResolutionCapable':True,'NSPrincipalClass':'NSApplication','NSLocalNetworkUsageDescription':'Pi Desk verbindet seine Oberfläche mit der lokalen OMP-Engine auf diesem Mac.','NSAppTransportSecurity':{'NSAllowsLocalNetworking':True}}
info.update({'SUFeedURL':'https://raw.githubusercontent.com/LiLoLama/pi-desk/main/updates/macos/appcast.xml','SUPublicEDKey':public_key,'SUEnableAutomaticChecks':True,'SUScheduledCheckInterval':21600,'SUAutomaticallyUpdate':False,'SUAllowsAutomaticUpdates':False})
# Only development builds accept PI_DESK_UPDATE_FEED as a test feed; release.mjs refuses such builds.
if not sign_id or os.environ.get('PI_DESK_TEST_FEED_BUILD')=='1': info['PIDeskDevBuild']=True
with (app/'Contents'/'Info.plist').open('wb') as f:plistlib.dump(info,f)
(resources/'BUILD.txt').write_text(f'Pi Desk {version} ({build_number})\nSwiftUI / AppKit\nmacOS 14+, Apple Silicon\nOMP 18.4.10\n'+('Developer ID signed, notarized for release.\n' if sign_id else 'Local ad-hoc signature, not notarized.\n'))
def sign(path,entitlements=None,preserve=False):
  command=['codesign','--force','--sign',sign_id or '-']
  if sign_id: command+=['--options','runtime','--timestamp']
  if entitlements and sign_id: command+=['--entitlements',str(entitlements)]
  if preserve: command+=['--preserve-metadata=entitlements']
  subprocess.run(command+[str(path)],check=True)
# Sign inside out. Sparkle's helpers carry our identity; the official OMP binary keeps its own Developer ID signature.
sparkle_bundle=frameworks/'Sparkle.framework'/'Versions'/'B'
sign(sparkle_bundle/'XPCServices'/'Installer.xpc')
sign(sparkle_bundle/'XPCServices'/'Downloader.xpc',preserve=True)
sign(sparkle_bundle/'Autoupdate')
sign(sparkle_bundle/'Updater.app')
sign(frameworks/'Sparkle.framework')
# Bundled Node needs JIT under the hardened runtime.
sign(resources/'node',entitlements=root/'native'/'node.entitlements')
sign(app)
subprocess.run(['codesign','--verify','--deep','--strict',str(app)],check=True)
backup=root/'dist'/'.previous-app'
if backup.exists():shutil.rmtree(backup)
if final.exists():final.rename(backup)
app.rename(final)
if backup.exists():shutil.rmtree(backup)
print(final)
