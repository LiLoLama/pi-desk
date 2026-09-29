import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {dataDirectory,runtimeBinary} from '../platform.mjs';
const {isLocal,externalURL}=createRequire(import.meta.url)('../desktop/security.cjs');
test('Windows data lives in LocalAppData and handles spaces and Unicode',()=>{
 assert.equal(dataDirectory('win32',{LOCALAPPDATA:'C:\\Users\\Jürgen Schmidt\\AppData\\Local'},''),'C:\\Users\\Jürgen Schmidt\\AppData\\Local\\Pi Desk');
 assert.equal(dataDirectory('win32',{},'C:\\Users\\Liam'),'C:\\Users\\Liam\\AppData\\Local\\Pi Desk');
});
test('Runtime selects Windows executable and explicit test runtime',()=>{
 assert.ok(runtimeBinary('/app','win32',{}).endsWith('runtime/win32-x64/omp.exe'));
 assert.equal(runtimeBinary('/app','win32',{PI_DESK_OMP:'/test/omp'}),'/test/omp');
});
test('Only the owned origin is trusted; external schemes and credentials are blocked',()=>{
 assert.ok(isLocal('http://127.0.0.1:1234/api/state','http://127.0.0.1:1234'));
 for(const url of ['http://127.0.0.1:1235/','http://127.0.0.1.evil.com:1234/','https://evil.example/','file:///C:/a'])assert.equal(isLocal(url,'http://127.0.0.1:1234'),false);
 for(const url of ['file:///C:/Windows/system32/cmd.exe','javascript:alert(1)','ms-settings:privacy','https://user:secret@example.com'])assert.equal(externalURL(url),null);
 assert.equal(externalURL('https://example.com/login'),'https://example.com/login');
});
