import readline from 'node:readline';
for await(const line of readline.createInterface({input:process.stdin})){
 const req=JSON.parse(line);if(req.id===undefined)continue;
 let result;
 if(req.method==='initialize')result={protocolVersion:req.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'pi-desk-test',version:'1'}};
 else if(req.method==='tools/list')result={tools:[{name:'proof',description:'Return a deterministic test proof.',inputSchema:{type:'object',properties:{},additionalProperties:false}}]};
 else if(req.method==='tools/call')result={content:[{type:'text',text:'MCP_APPROVED_PROOF'}]};
 else result={};
 process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:req.id,result})+'\n');
}
