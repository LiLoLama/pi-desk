// Local OAuth + MCP test server: 401 challenge, RFC 9728/8414 metadata, registration, authorize (redirects at once), token and refresh, MCP tools only with a valid bearer.
import http from 'node:http';import {createHash} from 'node:crypto';
export async function oauthFixture(opt={}){
 const state={registrations:[],authorizeRequests:[],tokenRequests:[],mcpAuth:[]};const tokens=new Set(),refreshTokens=new Set(),codes=new Map();let base,n=0;
 const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,base);let body='';for await(const c of req)body+=c;
  const json=(code,v,headers={})=>{res.writeHead(code,{'Content-Type':'application/json',...headers});res.end(JSON.stringify(v));};
  if(u.pathname==='/mcp'){
   const auth=req.headers.authorization||'';state.mcpAuth.push(auth);
   if(!tokens.has(auth.replace(/^Bearer /,'')))return json(401,{error:'unauthorized'},{'WWW-Authenticate':opt.challenge??`Bearer resource_metadata="${base}/.well-known/oauth-protected-resource/mcp"`});
   const m=body?JSON.parse(body):{};if(m.id===undefined){res.writeHead(202);res.end();return;}
   const result=m.method==='initialize'?{protocolVersion:m.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'oauth-fixture',version:'1'}}:m.method==='tools/list'?{tools:[{name:'proof',description:'Fixture tool.',inputSchema:{type:'object',properties:{}}}]}:{};
   return json(200,{jsonrpc:'2.0',id:m.id,result});
  }
  if(u.pathname==='/.well-known/oauth-protected-resource/mcp'||u.pathname==='/.well-known/oauth-protected-resource'){
   if(opt.noResourceMetadata)return json(404,{});
   return json(200,{...(opt.noResource?{}:{resource:`${base}/mcp`}),authorization_servers:[base],scopes_supported:opt.scopes??['profil:read','ausbildung:read']});
  }
  if(u.pathname==='/.well-known/oauth-authorization-server')return json(200,{issuer:opt.issuer??base,authorization_endpoint:`${base}/authorize`,token_endpoint:`${base}/token`,...(opt.noRegistration?{}:{registration_endpoint:`${base}/register`}),code_challenge_methods_supported:['S256'],grant_types_supported:['authorization_code','refresh_token'],token_endpoint_auth_methods_supported:['none']});
  if(u.pathname==='/register'){const r=JSON.parse(body);state.registrations.push(r);if(opt.refuseRegistration)return json(403,{error:'unapproved_client'});return json(201,{client_id:'client-'+(++n),redirect_uris:r.redirect_uris});}
  if(u.pathname==='/authorize'){
   const p=u.searchParams;state.authorizeRequests.push(Object.fromEntries(p));const back=new URL(p.get('redirect_uri'));
   if(opt.deny){back.searchParams.set('error','access_denied');back.searchParams.set('error_description','Zugriff verweigert');}
   else{const code='code-'+(++n);codes.set(code,p.get('code_challenge'));back.searchParams.set('code',code);}
   back.searchParams.set('state',p.get('state'));res.writeHead(302,{Location:back.toString()});res.end();return;
  }
  if(u.pathname==='/token'){
   const p=Object.fromEntries(new URLSearchParams(body));state.tokenRequests.push(p);
   if(opt.tokenDelay)await new Promise(r=>setTimeout(r,opt.tokenDelay));
   if(opt.tokenWithoutAccess)return json(200,{token_type:'Bearer'});
   if(p.grant_type==='authorization_code'){const challenge=codes.get(p.code);if(!challenge||createHash('sha256').update(p.code_verifier||'').digest('base64url')!==challenge)return json(400,{error:'invalid_grant'});codes.delete(p.code);}
   else if(p.grant_type!=='refresh_token'||!refreshTokens.has(p.refresh_token))return json(400,{error:'invalid_grant'});
   const access='access-'+(++n),refresh='refresh-'+n;tokens.add(access);refreshTokens.add(refresh);
   return json(200,{access_token:access,token_type:'Bearer',expires_in:opt.expiresIn??3600,refresh_token:refresh});
  }
  res.writeHead(404);res.end();
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;
 return {url:`${base}/mcp`,base,state,close:()=>{server.closeAllConnections();return new Promise(r=>server.close(r));}};
}
// Plays the browser: follows the authorize redirect to the loopback callback.
export async function browser(url){const r=await fetch(url,{redirect:'manual'});return fetch(r.headers.get('location'));}
