import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';import {LocalModels,scanFolders,suitability} from '../local-models.mjs';
test('library scans deduplicated roots, MLX, GGUF shards and preserves files',async()=>{
 const root=await mkdtemp('/private/tmp/pi-library-unit-');try{
 const models=root+'/models';await mkdir(models);await writeFile(models+'/tiny.gguf','GGUF');await writeFile(models+'/mmproj.gguf','projection');
 await mkdir(models+'/mlx');for(const [name,body] of Object.entries({'config.json':'{"model_type":"qwen"}','tokenizer.json':'{}','model.safetensors':'weights'}))await writeFile(models+'/mlx/'+name,body);
 await symlink(models,models+'/cycle');const scan=await scanFolders([models,models+'/mlx']);assert.equal(scan.models.length,2);assert.deepEqual(scan.errors,[]);
 const snapshot=models+'/models--owner--model/snapshots/'+'a'.repeat(40);await mkdir(snapshot,{recursive:true});for(const [name,body] of Object.entries({'config.json':'{}','tokenizer.json':'{}','model.safetensors':'weights'}))await writeFile(snapshot+'/'+name,body);
 assert.ok((await scanFolders([models])).models.some(m=>m.name==='owner/model'));
 await rm(models+'/models--owner--model',{recursive:true});
 const c=new LocalModels(root+'/data');await mkdir(root+'/data');await c.init();await c.folder(models);assert.equal((await c.status()).models.length,2);await c.folder(models,true);assert.equal((await c.status()).models.length,0);assert.equal(await readFile(models+'/tiny.gguf','utf8'),'GGUF');
 assert.equal(suitability(50*1024**3,16*1024**3).rank,2);assert.equal(suitability(2*1024**3,32*1024**3).rank,0);
 c.begin('cancel',async signal=>{await new Promise(r=>setTimeout(r,10));signal.throwIfAborted();});assert.throws(()=>c.begin('second',()=>{}),/abwarten/);c.cancel();await c.promise;assert.equal(c.job.error,'Abgebrochen.');await c.close();
 }finally{await rm(root,{recursive:true,force:true});}
});
