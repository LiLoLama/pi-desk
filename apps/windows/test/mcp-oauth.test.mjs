import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import net from 'node:net';
import {login,OAuthError} from '../mcp-oauth.mjs';import {oauthFixture,browser} from './oauth-fixture.mjs';
const freePort=()=>new Promise(r=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
async function withFixture(opt,fn){const f=await oauthFixture(opt);try{await fn(f);}finally{await f.close();}}
test('registers, opens the browser and returns the credential in OMP storage shape',()=>withFixture({},async f=>{
 const before=Date.now();const c=await login({url:f.url,type:'http'},{onUrl:u=>{browser(u);}});
 assert.equal(f.state.registrations.length,1);const r=f.state.registrations[0];
 assert.equal(r.client_name,'Pi Desk');assert.equal(r.token_endpoint_auth_method,'none');assert.equal(r.application_type,'native');assert.match(r.redirect_uris[0],/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
 const a=f.state.authorizeRequests[0];assert.equal(a.code_challenge_method,'S256');assert.equal(a.scope,'profil:read ausbildung:read');assert.equal(a.resource,f.url);assert.equal(a.client_id,'client-1');
 assert.equal(f.state.tokenRequests[0].grant_type,'authorization_code');assert.ok(f.state.tokenRequests[0].code_verifier);
 assert.match(c.access,/^access-/);assert.match(c.refresh,/^refresh-/);assert.equal(c.clientId,'client-1');assert.equal(c.tokenUrl,f.base+'/token');assert.equal(c.authorizationUrl,f.base+'/authorize');assert.equal(c.resource,f.url);
 assert.ok(c.expires>=before+3600e3&&c.expires<=Date.now()+3600e3);assert.equal(c.clientSecret,undefined);
}));
test('a fixed client id and port skip registration and send the secret',()=>withFixture({},async f=>{
 const port=await freePort();const c=await login({url:f.url,type:'http',oauth:{clientId:'fixed',clientSecret:'secret',callbackPort:port}},{onUrl:u=>{browser(u);}});
 assert.equal(f.state.registrations.length,0);assert.equal(f.state.authorizeRequests[0].redirect_uri,`http://127.0.0.1:${port}/callback`);
 assert.equal(f.state.tokenRequests[0].client_secret,'secret');assert.equal(c.clientId,'fixed');assert.equal(c.clientSecret,'secret');
 await new Promise((resolve,reject)=>{const s=net.createServer().once('error',reject).listen(port,'127.0.0.1',()=>s.close(resolve));});
}));
test('a server without 401 needs no login',async()=>{
 const s=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end('{}');});await new Promise(r=>s.listen(0,'127.0.0.1',r));
 try{await assert.rejects(login({url:`http://127.0.0.1:${s.address().port}/mcp`,type:'http'}),/verlangt keine Anmeldung/);}finally{s.close();}
});
test('missing metadata and a wrong issuer are rejected',async()=>{
 await withFixture({noResourceMetadata:true,challenge:'Bearer'},f=>assert.rejects(login({url:f.url,type:'http'}),/keinen gültigen Anmeldeserver/));
 await withFixture({issuer:'https://other.example'},f=>assert.rejects(login({url:f.url,type:'http'}),/keinen gültigen Anmeldeserver/));
});
test('servers without registration ask for a client id',async()=>{
 await withFixture({refuseRegistration:true},f=>assert.rejects(login({url:f.url,type:'http'}),/registrierte App/));
 await withFixture({noRegistration:true},f=>assert.rejects(login({url:f.url,type:'http'}),/registrierte App/));
});
test('a busy fixed port is reported',()=>withFixture({},async f=>{
 const blocker=net.createServer();await new Promise(r=>blocker.listen(0,'127.0.0.1',r));const port=blocker.address().port;
 try{await assert.rejects(login({url:f.url,type:'http',oauth:{clientId:'fixed',callbackPort:port}}),new RegExp(`Port ${port} ist belegt`));}finally{blocker.close();}
}));
test('a denial in the browser stops the login',()=>withFixture({deny:true},f=>assert.rejects(login({url:f.url,type:'http'},{onUrl:u=>{browser(u);}}),/abgelehnt: Zugriff verweigert/)));
test('a foreign state is ignored and the real callback still completes',()=>withFixture({},async f=>{
 const c=await login({url:f.url,type:'http'},{onUrl:async u=>{const redirect=new URL(new URL(u).searchParams.get('redirect_uri'));redirect.searchParams.set('code','x');redirect.searchParams.set('state','fremd');assert.equal((await fetch(redirect)).status,400);browser(u);}});
 assert.match(c.access,/^access-/);
}));
test('a token answer without access token fails',()=>withFixture({tokenWithoutAccess:true},f=>assert.rejects(login({url:f.url,type:'http'},{onUrl:u=>{browser(u);}}),/nicht bestätigt/)));
test('timeout and cancel stop the login with a message',async()=>{
 await withFixture({},f=>assert.rejects(login({url:f.url,type:'http'},{timeoutMs:100}),/ohne Antwort/));
 await withFixture({},async f=>{const ctl=new AbortController();await assert.rejects(login({url:f.url,type:'http'},{signal:ctl.signal,onUrl:()=>ctl.abort()}),/abgebrochen/);});
});
test('scope: advanced setting, then challenge, then metadata; resource falls back to the server URL',async()=>{
 await withFixture({},async f=>{await login({url:f.url,type:'http',oauth:{scope:'eigene'}},{onUrl:u=>{browser(u);}});assert.equal(f.state.authorizeRequests[0].scope,'eigene');});
 await withFixture({challenge:'Bearer scope="aus-challenge"'},async f=>{await login({url:f.url,type:'http'},{onUrl:u=>{browser(u);}});assert.equal(f.state.authorizeRequests[0].scope,'aus-challenge');});
 await withFixture({noResource:true},async f=>{const c=await login({url:f.url,type:'http'},{onUrl:u=>{browser(u);}});assert.equal(f.state.authorizeRequests[0].resource,f.url);assert.equal(c.resource,f.url);});
});
test('errors are OAuthError instances',()=>withFixture({noRegistration:true},async f=>{await assert.rejects(login({url:f.url,type:'http'}),e=>e instanceof OAuthError);}));
test('a cancel during the token exchange rejects and returns no credential',()=>withFixture({tokenDelay:1000},async f=>{
 const ctl=new AbortController();let credential;
 const result=login({url:f.url,type:'http'},{signal:ctl.signal,onUrl:u=>{browser(u);(async()=>{while(!f.state.tokenRequests.length)await new Promise(r=>setTimeout(r,5));ctl.abort();})();}}).then(c=>{credential=c;return c;});
 await assert.rejects(result,e=>e instanceof OAuthError&&/abgebrochen/.test(e.message));assert.equal(credential,undefined);
}));
