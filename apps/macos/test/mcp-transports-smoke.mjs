import http from 'node:http';import assert from 'node:assert/strict';import {mkdtemp,mkdir,rm} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import {Capabilities} from '../capabilities.mjs';
const root=await mkdtemp('/private/tmp/pi-mcp-transports-');await mkdir(root+'/agent');const capabilities=new Capabilities(root);await capabilities.init();let stream;let calls=0;
function answer(req){if(req.method==='initialize')return {protocolVersion:req.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'transport-fixture',version:'1'}};if(req.method==='tools/list')return {tools:[{name:'proof',description:'Fixture tool.',inputSchema:{type:'object',properties:{}}}]};if(req.method==='tools/call')calls++;return {};}
const server=http.createServer(async(req,res)=>{
 if(req.headers.authorization!=='Bearer local-fixture'){res.writeHead(401);res.end();return;}
 if(req.url==='/sse'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'});stream=res;res.write('event: endpoint\ndata: /message\n\n');return;}
 if(req.method==='POST'){
 let body='';for await(const c of req)body+=c;const message=JSON.parse(body);
 if(message.id===undefined){res.writeHead(202);res.end();return;}
 const response={jsonrpc:'2.0',id:message.id,result:answer(message)};
 if(req.url==='/message'){stream.write('event: message\ndata: '+JSON.stringify(response)+'\n\n');res.writeHead(202);res.end();}
 else{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(response));}return;
 }res.writeHead(405);res.end();
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{for(const type of ['http','sse']){
 await capabilities.saveServer({name:type,config:{type,url:`http://127.0.0.1:${server.address().port}/${type}`,headers:{Authorization:'Bearer local-fixture'},enabled:false}});
 const result=await capabilities.probe(type,fileURLToPath(new URL('../runtime/omp',import.meta.url)),process.env);assert.equal(result.connected,true);assert.deepEqual(result.tools,['proof']);
 }assert.equal(calls,0);console.log('PASS: real OMP HTTP and SSE initialize/tools-list with headers; no tool execution');
}finally{stream?.end();server.closeAllConnections();await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
