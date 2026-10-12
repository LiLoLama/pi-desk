// MCP OAuth login for HTTP/SSE servers (RFC 9728 discovery, RFC 8414 metadata, RFC 7591 registration, PKCE S256, loopback callback).
// OMP 18.4.10 has no non-TUI entry point for this; it uses and refreshes the stored result itself.
import http from 'node:http';import {createHash,randomBytes} from 'node:crypto';
const REQUEST_TIMEOUT=10000,LOGIN_TIMEOUT=300000;
export class OAuthError extends Error{}
const fail=message=>{throw new OAuthError(message);};
const trim=u=>String(u).replace(/\/+$/,'');
const NO_SERVER='Der Server nennt keinen gültigen Anmeldeserver.',NEEDS_APP='Dieser Server verlangt eine registrierte App. Trage unter ‚Erweiterte Anmeldung‘ eine Client-ID ein.';
const reason=e=>e?.cause?.code||e?.message||String(e);
export function parseChallenge(header){const h=String(header||'');return {resourceMetadata:h.match(/resource_metadata\s*=\s*"([^"]+)"/i)?.[1]||'',scope:h.match(/\bscope\s*=\s*"([^"]+)"/i)?.[1]||''};}
async function getJSON(fetchFn,url){try{const r=await fetchFn(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(REQUEST_TIMEOUT)});if(!r.ok)return null;return await r.json();}catch{return null;}}
export async function challenge(url,type,headers,fetchFn){
 const h=Object.fromEntries(Object.entries(headers||{}).filter(([k])=>k.toLowerCase()!=='authorization'));let r;
 try{r=type==='sse'?await fetchFn(url,{headers:{...h,Accept:'text/event-stream'},signal:AbortSignal.timeout(REQUEST_TIMEOUT)}):await fetchFn(url,{method:'POST',headers:{...h,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'Pi Desk',version:'1'}}}),signal:AbortSignal.timeout(REQUEST_TIMEOUT)});}
 catch(e){fail('Server nicht erreichbar: '+reason(e));}
 try{await r.body?.cancel();}catch{}
 if(r.status!==401&&r.status!==403)fail(r.ok?'Dieser Server verlangt keine Anmeldung.':`Server nicht erreichbar: HTTP ${r.status}`);
 return parseChallenge(r.headers.get('www-authenticate'));
}
export async function discover(url,ch,fetchFn){
 const u=new URL(url),p=u.pathname==='/'?'':trim(u.pathname);
 let prm=null;for(const candidate of new Set([ch.resourceMetadata,`${u.origin}/.well-known/oauth-protected-resource${p}`,`${u.origin}/.well-known/oauth-protected-resource`].filter(Boolean))){prm=await getJSON(fetchFn,candidate);if(prm)break;}
 const issuer=prm?.authorization_servers?.[0];if(typeof issuer!=='string')fail(NO_SERVER);
 let a;try{a=new URL(issuer);}catch{fail(NO_SERVER);}const ap=a.pathname==='/'?'':trim(a.pathname);
 let meta=null;for(const candidate of [`${a.origin}/.well-known/oauth-authorization-server${ap}`,`${a.origin}/.well-known/openid-configuration${ap}`,...(ap?[`${a.origin}${ap}/.well-known/openid-configuration`]:[])]){const j=await getJSON(fetchFn,candidate);if(j&&trim(j.issuer||'')===trim(issuer)){meta=j;break;}}
 if(typeof meta?.authorization_endpoint!=='string'||typeof meta?.token_endpoint!=='string')fail(NO_SERVER);
 if(Array.isArray(meta.code_challenge_methods_supported)&&!meta.code_challenge_methods_supported.includes('S256'))fail('Der Anmeldeserver unterstützt kein PKCE mit S256.');
 return {authorizationUrl:meta.authorization_endpoint,tokenUrl:meta.token_endpoint,registrationUrl:typeof meta.registration_endpoint==='string'?meta.registration_endpoint:'',scopes:Array.isArray(prm.scopes_supported)?prm.scopes_supported.join(' '):'',resource:typeof prm.resource==='string'?prm.resource:url};
}
export function listen(port=0){return new Promise((resolve,reject)=>{const server=http.createServer();server.once('error',e=>reject(e.code==='EADDRINUSE'?new OAuthError(`Der Rückleitungs-Port ${port} ist belegt. Beende das Programm, das ihn nutzt, oder wähle einen anderen Port, der beim Anbieter eingetragen ist.`):e));server.listen(port,'127.0.0.1',()=>resolve(server));});}
const page=(title,text)=>`<!doctype html><html lang="de"><meta charset="utf-8"><title>${title}</title><body style="margin:0;height:100vh;display:grid;place-items:center;background:#1b1d1e;color:#e7ebe5;font:15px -apple-system,'Segoe UI',sans-serif"><main><h1 style="font-size:20px;font-weight:600">${title}</h1><p>${text}</p></main></body></html>`;
export function waitForCode(server,state,signal){return new Promise((resolve,reject)=>{
 const onAbort=()=>reject(signal.reason);if(signal.aborted)return onAbort();signal.addEventListener('abort',onAbort,{once:true});
 const finish=(fn,v)=>{signal.removeEventListener('abort',onAbort);fn(v);};
 server.on('request',(req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');const html=(code,title,text)=>{res.writeHead(code,{'Content-Type':'text/html; charset=utf-8'});res.end(page(title,text));};
  if(u.pathname!=='/callback'){res.writeHead(404);res.end();return;}
  if(u.searchParams.get('state')!==state)return html(400,'Unbekannte Anmeldung','Diese Rückleitung gehört nicht zur laufenden Anmeldung in Pi Desk.');
  const error=u.searchParams.get('error');
  if(error){html(200,'Anmeldung abgelehnt','Du kannst dieses Fenster schließen.');return finish(reject,new OAuthError('Anmeldung im Browser abgelehnt: '+(u.searchParams.get('error_description')||error)));}
  const code=u.searchParams.get('code');if(!code)return html(400,'Unvollständige Rückleitung','Es fehlt der Anmeldecode.');
  html(200,'Anmeldung abgeschlossen','Du kannst dieses Fenster schließen und zu Pi Desk zurückkehren.');finish(resolve,code);
 });
});}
export async function register(registrationUrl,redirectUri,scope,fetchFn){
 if(!registrationUrl)fail(NEEDS_APP);let r;
 try{r=await fetchFn(registrationUrl,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({client_name:'Pi Desk',redirect_uris:[redirectUri],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none',application_type:'native',...(scope?{scope}:{})}),signal:AbortSignal.timeout(REQUEST_TIMEOUT)});}
 catch(e){fail('Server nicht erreichbar: '+reason(e));}
 const j=r.ok?await r.json().catch(()=>null):null;if(typeof j?.client_id!=='string')fail(NEEDS_APP);
 return {clientId:j.client_id,clientSecret:typeof j.client_secret==='string'?j.client_secret:undefined};
}
export function authorizeUrl(endpoint,{clientId,redirectUri,challenge,state,scope,resource}){
 const u=new URL(endpoint),p=u.searchParams;p.set('response_type','code');p.set('client_id',clientId);p.set('redirect_uri',redirectUri);p.set('code_challenge',challenge);p.set('code_challenge_method','S256');p.set('state',state);if(scope)p.set('scope',scope);if(resource)p.set('resource',resource);return u.toString();
}
export async function exchange(tokenUrl,{code,redirectUri,clientId,clientSecret,verifier,resource},fetchFn,now){
 const body=new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:redirectUri,client_id:clientId,code_verifier:verifier});if(resource)body.set('resource',resource);if(clientSecret)body.set('client_secret',clientSecret);
 let r;try{r=await fetchFn(tokenUrl,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body,signal:AbortSignal.timeout(REQUEST_TIMEOUT)});}catch(e){fail('Der Anmeldeserver hat die Anmeldung nicht bestätigt: '+reason(e));}
 const j=await r.json().catch(()=>null);
 if(!r.ok||typeof j?.access_token!=='string')fail('Der Anmeldeserver hat die Anmeldung nicht bestätigt: '+(j?.error_description||j?.error||`HTTP ${r.status}`));
 return {access:j.access_token,refresh:typeof j.refresh_token==='string'?j.refresh_token:'',expires:now()+(Number(j.expires_in)>0?Number(j.expires_in):3600)*1000};
}
export async function login({url,type='http',headers={},oauth={}},{fetchFn=fetch,signal,onUrl,timeoutMs=LOGIN_TIMEOUT,now=Date.now}={}){
 const ctl=new AbortController(),stop=ctl.signal;const timer=setTimeout(()=>ctl.abort(new OAuthError('Die Anmeldung wurde nach 5 Minuten ohne Antwort aus dem Browser abgebrochen.')),timeoutMs);
 const cancel=()=>ctl.abort(new OAuthError('Anmeldung abgebrochen.'));if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});
 const send=(u,o={})=>fetchFn(u,{...o,signal:o.signal?AbortSignal.any([o.signal,stop]):stop});
 let server;
 try{
  stop.throwIfAborted();
  const ch=await challenge(url,type,headers,send);const meta=await discover(url,ch,send);const scope=oauth.scope||ch.scope||meta.scopes;stop.throwIfAborted();
  server=await listen(oauth.callbackPort||0);const redirectUri=`http://127.0.0.1:${server.address().port}/callback`;
  const client=oauth.clientId?{clientId:oauth.clientId,clientSecret:oauth.clientSecret||undefined}:await register(meta.registrationUrl,redirectUri,scope,send);stop.throwIfAborted();
  const verifier=randomBytes(32).toString('base64url'),state=randomBytes(16).toString('hex');
  const code=waitForCode(server,state,stop);
  onUrl?.(authorizeUrl(meta.authorizationUrl,{clientId:client.clientId,redirectUri,challenge:createHash('sha256').update(verifier).digest('base64url'),state,scope,resource:meta.resource}));
  const tokens=await exchange(meta.tokenUrl,{code:await code,redirectUri,clientId:client.clientId,clientSecret:client.clientSecret,verifier,resource:meta.resource},send,now);stop.throwIfAborted();
  return {...tokens,tokenUrl:meta.tokenUrl,clientId:client.clientId,...(client.clientSecret?{clientSecret:client.clientSecret}:{}),resource:meta.resource,authorizationUrl:meta.authorizationUrl};
 }catch(e){if(stop.aborted)throw stop.reason;throw e;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
}
