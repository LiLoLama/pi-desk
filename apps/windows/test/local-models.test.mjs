import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,readFile,rm,symlink,realpath} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {LocalModels,scanFolders,suitability,ggufMetadata,ggufProfile,kvProfile,configProfile,contextOptions,defaultContext} from '../local-models.mjs';
test('library scans deduplicated roots, MLX, GGUF shards and preserves files',async()=>{
 const root=await realpath(await mkdtemp(path.join(os.tmpdir(),'pi-library-unit-')));try{
 const models=path.join(root,'models');await mkdir(models);await writeFile(models+'/tiny.gguf','GGUF');await writeFile(models+'/mmproj.gguf','projection');
 await mkdir(models+'/mlx');for(const [name,body] of Object.entries({'config.json':'{"model_type":"qwen"}','tokenizer.json':'{}','model.safetensors':'weights'}))await writeFile(models+'/mlx/'+name,body);
 await symlink(models,models+'/cycle',process.platform==='win32'?'junction':'dir');const scan=await scanFolders([models,models+'/mlx']);assert.equal(scan.models.length,2);assert.deepEqual(scan.errors,[]);
 const snapshot=models+'/models--owner--model/snapshots/'+'a'.repeat(40);await mkdir(snapshot,{recursive:true});for(const [name,body] of Object.entries({'config.json':'{}','tokenizer.json':'{}','model.safetensors':'weights'}))await writeFile(snapshot+'/'+name,body);
 assert.ok((await scanFolders([models])).models.some(m=>m.name==='owner/model'));
 await rm(models+'/models--owner--model',{recursive:true});
 const c=new LocalModels(root+'/data');await mkdir(root+'/data');await c.init();await c.folder(models);assert.equal((await c.status()).models.length,2);await c.folder(models,true);assert.equal((await c.status()).models.length,0);assert.equal(await readFile(models+'/tiny.gguf','utf8'),'GGUF');
 assert.equal(suitability(50*1024**3,16*1024**3).rank,2);assert.equal(suitability(2*1024**3,32*1024**3).rank,0);
 c.begin('cancel',async signal=>{await new Promise(r=>setTimeout(r,10));signal.throwIfAborted();});assert.throws(()=>c.begin('second',()=>{}),/abwarten/);c.cancel();await c.promise;assert.equal(c.job.error,'Abgebrochen.');await c.close();
 }finally{await rm(root,{recursive:true,force:true});}
});
const ggufFile=entries=>{const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;},u64=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b;},str=s=>Buffer.concat([u64(Buffer.byteLength(s)),Buffer.from(s)]);
 const value=([type,v])=>type===8?str(v):type===4?u32(v):type==='strings'?Buffer.concat([u32(9),u32(8),u64(v.length),...v.map(str)].slice(1)):Buffer.concat([u32(4),u64(v.length),...v.map(u32)]);
 return Buffer.concat([Buffer.from('GGUF'),u32(3),u64(0),u64(entries.length),...entries.map(([k,type,v])=>Buffer.concat([str(k),u32(type==='strings'||type==='u32s'?9:type),value([type,v])]))]);};
const llama=(extra=[])=>ggufFile([['general.architecture',8,'llama'],['tokenizer.ggml.tokens','strings',Array.from({length:5000},(_,i)=>'t'.repeat(300)+i)],['tokenizer.ggml.token_type','u32s',Array(10000).fill(1)],['llama.context_length',4,131072],['llama.block_count',4,32],['llama.attention.head_count',4,32],['llama.attention.head_count_kv',4,8],['llama.embedding_length',4,4096],...extra]);
test('GGUF header yields trained context and KV size without reading weights',async()=>{
 const root=await realpath(await mkdtemp(path.join(os.tmpdir(),'pi-gguf-meta-')));try{await writeFile(path.join(root,'m.gguf'),llama());const meta=await ggufMetadata(path.join(root,'m.gguf'));
 assert.equal(meta['llama.embedding_length'],4096);assert.equal(meta['tokenizer.ggml.tokens'],undefined);assert.deepEqual(ggufProfile(meta),{trained:131072,kvBytesPerToken:131072});
 await writeFile(path.join(root,'bad.gguf'),'GGUF');await assert.rejects(ggufMetadata(path.join(root,'bad.gguf')));
 }finally{await rm(root,{recursive:true,force:true});}
 assert.deepEqual(kvProfile({layers:4,heads:32,kvHeads:[8,0,8,0],keyLength:128}),{trained:null,kvBytesPerToken:8192});
 assert.deepEqual(configProfile({text_config:{num_hidden_layers:26,num_attention_heads:32,num_key_value_heads:8,head_dim:128,max_position_embeddings:262144}}),{trained:262144,kvBytesPerToken:106496});
});
test('context options follow the model limit and this device memory',()=>{
 const GiB=1024**3,model={bytes:5*GiB,trained:131072,kvBytesPerToken:131072};
 const small=contextOptions(model,16*GiB);assert.deepEqual(small.map(o=>[o.size,o.fit]),[[16384,'good'],[32768,'tight'],[65536,'too-large'],[131072,'too-large']]);assert.equal(defaultContext(small),32768);assert.ok(small[2].disabled);
 const large=contextOptions(model,128*GiB);assert.ok(large.every(o=>o.fit==='good'));assert.equal(defaultContext(large),32768);
 assert.deepEqual(contextOptions({...model,trained:40960},128*GiB).map(o=>o.size),[16384,32768,40960]);
 const tiny=contextOptions({...model,trained:8192},128*GiB);assert.deepEqual(tiny.map(o=>[o.size,o.tooSmall]),[[8192,true]]);assert.equal(defaultContext(tiny),8192);
 assert.equal(contextOptions({...model,trained:10485760},2048*GiB).at(-1).size,1048576);
 assert.deepEqual(contextOptions({bytes:GiB}).map(o=>o.fit),['unknown','unknown','unknown','unknown']);
});
test('context length is chosen per model, persisted and locked while loaded',async()=>{
 const root=await realpath(await mkdtemp(path.join(os.tmpdir(),'pi-context-unit-')));try{
 const c=new LocalModels(root);c.memory=16*1024**3;await c.init();const folder=c.config.folders[0];await writeFile(path.join(folder,'m.gguf'),llama());await c.scan();
 const [m]=(await c.status()).models;assert.equal(m.context.size,32768);assert.equal(m.context.max,131072);
 await assert.rejects(c.setContext(m.id,8192),/Kontextlänge/);await assert.rejects(c.setContext('missing',32768),/nicht gefunden/);await assert.rejects(c.setContext(m.id,131072),/Arbeitsspeicher/);
 assert.equal((await c.setContext(m.id,16384)).models[0].context.size,16384);assert.equal(JSON.parse(await readFile(path.join(root,'local-models.json'),'utf8')).contexts[m.id],16384);
 const reloaded=new LocalModels(root);reloaded.memory=16*1024**3;await reloaded.init();assert.equal((await reloaded.status()).models[0].context.size,16384);
 reloaded.active={id:m.id};reloaded.child={exitCode:null};await assert.rejects(reloaded.setContext(m.id,32768),/entladen/);
 reloaded.child={exitCode:1};assert.equal((await reloaded.setContext(m.id,32768)).models[0].context.size,32768);reloaded.child=null;reloaded.active=null;
 }finally{await rm(root,{recursive:true,force:true});}
});
test('download folder stays connected behind a symlinked data directory',async()=>{
 const {realpath}=await import('node:fs/promises'),path=(await import('node:path')).default,os=(await import('node:os')).default;
 const root=await realpath(await mkdtemp(path.join(os.tmpdir(),'pi-canonical-unit-')));try{
 const real=path.join(root,'real'),link=path.join(root,'link');await mkdir(path.join(real,'local-models'),{recursive:true});await mkdir(path.join(real,'extra'));await symlink(real,link,'junction');
 const downloads=path.join(real,'local-models','models'),raw=path.join(link,'local-models','models');
 // Profile of the previous version: raw download path, duplicate entry and a stored context length.
 await writeFile(path.join(real,'local-models.json'),JSON.stringify({folders:[raw,raw,path.join(link,'extra')],contexts:{abc:16384}}));
 const c=new LocalModels(link);await c.init();assert.deepEqual(c.config.folders,[downloads,path.join(real,'extra')]);
 const saved=JSON.parse(await readFile(path.join(real,'local-models.json'),'utf8'));assert.deepEqual(saved.folders,c.config.folders);assert.deepEqual(saved.contexts,{abc:16384});
 assert.equal(await c.downloadTarget(raw),downloads);assert.equal(await c.downloadTarget(downloads),downloads);await assert.rejects(c.downloadTarget(real),/verbundenen Modellordner/);
 await assert.rejects(c.folder(downloads,true),/Downloadordner/);
 const freshReal=path.join(root,'fresh'),freshLink=path.join(root,'fresh-link');await mkdir(freshReal);await symlink(freshReal,freshLink,'junction');
 const fresh=new LocalModels(freshLink);await fresh.init();assert.deepEqual(fresh.config.folders,[path.join(freshReal,'local-models','models')]);assert.equal(await fresh.downloadTarget(path.join(freshLink,'local-models','models')),fresh.config.folders[0]);
 await c.close();await fresh.close();
 }finally{await rm(root,{recursive:true,force:true});}
});
