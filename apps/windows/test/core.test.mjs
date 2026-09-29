import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,mkdir,symlink,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {Decoder} from '../rpc.mjs';import {contained,textFile,listFiles} from '../files.mjs';
test('RPC v2 reconstructs split UTF-8 and rejects malformed/interleaved sequences',()=>{const b=Buffer.from(JSON.stringify({type:'message',text:'Grüße 🫧'}));const d=new Decoder();const frames=[b.subarray(0,25),b.subarray(25)].map((x,i)=>({type:'rpc_chunk',chunkId:'1',index:i,count:2,byteLength:b.length,data:x.toString('base64')}));assert.equal(d.decode(frames[0]),undefined);assert.deepEqual(d.decode(frames[1]),{type:'message',text:'Grüße 🫧'});const bad=new Decoder();bad.decode(frames[0]);assert.throws(()=>bad.decode({type:'response'}));assert.throws(()=>new Decoder().decode(frames[1]));assert.throws(()=>new Decoder().decode({...frames[0],byteLength:67108865}));assert.throws(()=>new Decoder().decode({...frames[0],data:'%%%%'}));});
test('RPC send splits oversized frames into rpc_chunk',async()=>{
  const {Rpc}=await import('../rpc.mjs');
  const writes=[];
  const rpc=Object.create(Rpc.prototype);
  rpc.closed=false;
  rpc.child={stdin:{write(chunk){writes.push(Buffer.isBuffer(chunk)?chunk.toString():chunk);}}};
  rpc.send({type:'prompt',message:'x'.repeat(950000)});
  assert.ok(writes.length>1);
  assert.ok(writes.every(line=>line.endsWith('\n')));
  assert.equal(JSON.parse(writes[0]).type,'rpc_chunk');
});
test('Context blocks traversal, symlink escapes, binary and oversized files',async()=>{const tmp=await mkdtemp(path.join(os.tmpdir(),'pi-desk-test-'));try{const root=path.join(tmp,'project');await mkdir(root);await writeFile(path.join(tmp,'outside'),'private');await writeFile(path.join(root,'hello.txt'),'Hallo');await mkdir(path.join(tmp,'outside-dir'));await writeFile(path.join(tmp,'outside-dir','private'),'private');await symlink(path.join(tmp,'outside-dir'),path.join(root,'escape'),process.platform==='win32'?'junction':'dir');await writeFile(path.join(root,'binary'),Buffer.from([0,1]));await writeFile(path.join(root,'large'),'x'.repeat(250001));assert.equal(await textFile(root,'hello.txt'),'Hallo');await assert.rejects(contained(root,'../outside'));await assert.rejects(contained(root,'escape'));await assert.rejects(textFile(root,'binary'));await assert.rejects(textFile(root,'large'));assert.ok((await listFiles(root)).some(f=>f.name==='hello.txt'));}finally{await rm(tmp,{recursive:true,force:true});}});
