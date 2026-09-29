import {spawn} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {randomUUID} from 'node:crypto';
export class Decoder {
  chunk=null;
  decode(f){
    if(f.type!=='rpc_chunk'){if(this.chunk)throw Error('Interrupted RPC chunk');return f;}
    if(!Number.isInteger(f.count)||f.count<1||f.count>1024||!Number.isInteger(f.byteLength)||f.byteLength>67108864||f.byteLength<1||typeof f.data!=='string'||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(f.data))throw Error('Invalid RPC chunk');
    if(!this.chunk){if(f.index!==0||typeof f.chunkId!=='string')throw Error('Invalid chunk start');this.chunk={id:f.chunkId,count:f.count,length:f.byteLength,parts:[],size:0};}
    const c=this.chunk;if(c.id!==f.chunkId||c.count!==f.count||c.length!==f.byteLength||c.parts.length!==f.index)throw Error('Invalid chunk sequence');
    const b=Buffer.from(f.data,'base64');c.size+=b.length;if(c.size>c.length)throw Error('Chunk overflow');c.parts.push(b);
    if(c.parts.length===c.count){if(c.size!==c.length)throw Error('Chunk length mismatch');this.chunk=null;return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(c.parts)));}
  }
}
export class Rpc extends EventEmitter {
  pending=new Map();decoder=new Decoder();buffer='';closed=false;
  constructor(binary,args,env){super();this.ready=new Promise((resolve,reject)=>{this.resolveReady=resolve;this.rejectReady=reject;});this.child=spawn(binary,args,{env,windowsHide:true,stdio:['pipe','pipe','pipe']});this.child.stdout.setEncoding('utf8');this.child.stdout.on('data',s=>{try{this.buffer+=s;if(Buffer.byteLength(this.buffer)>2000000&&!this.buffer.includes('\n'))throw Error('RPC frame too large');let i;while((i=this.buffer.indexOf('\n'))>=0){const line=this.buffer.slice(0,i);this.buffer=this.buffer.slice(i+1);if(Buffer.byteLength(line)>1048576)throw Error('RPC physical frame too large');if(!line.trim())continue;const f=this.decoder.decode(JSON.parse(line));if(f)this.frame(f);}}catch(e){this.fail(e);this.child.kill();}});this.child.stderr.on('data',()=>{});this.child.on('error',e=>this.fail(e));this.child.on('exit',(code)=>this.fail(Error(`OMP beendet (${code})`)));this.child.stdin.on('error',e=>this.fail(e));this.timer=setTimeout(()=>{this.fail(Error('OMP-Start dauert zu lange'));this.child.kill();},60000);}
  frame(f){if(f.type==='ready'){clearTimeout(this.timer);this.resolveReady(f);}if(f.type==='response'&&this.pending.has(f.id)){const p=this.pending.get(f.id);clearTimeout(p.timer);this.pending.delete(f.id);f.success?p.resolve(f.data):p.reject(Error(f.error||'OMP request failed'));}this.emit('frame',f);}
  fail(e){if(this.closed)return;this.closed=true;clearTimeout(this.timer);this.rejectReady(e);for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(e);}this.pending.clear();this.emit('closed',e);}
  send(f){
    if(this.closed)throw Error('OMP ist nicht verbunden');
    const bytes=Buffer.from(JSON.stringify(f),'utf8');
    if(bytes.length<=900000){this.child.stdin.write(bytes);this.child.stdin.write('\n');return;}
    if(bytes.length>20000000)throw Error('Nachricht zu groß');
    const chunk=600000,count=Math.ceil(bytes.length/chunk),id=randomUUID();
    for(let i=0;i<count;i++){
      const part=bytes.subarray(i*chunk,(i+1)*chunk);
      const line=JSON.stringify({type:'rpc_chunk',chunkId:id,index:i,count,byteLength:bytes.length,data:part.toString('base64')})+'\n';
      if(Buffer.byteLength(line)>1048576)throw Error('RPC-Stück zu groß');
      this.child.stdin.write(line);
    }
  }
  request(type,data={},timeout=30000){const id=randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error(`${type}: Zeitüberschreitung`));},timeout);this.pending.set(id,{resolve,reject,timer});try{this.send({id,type,...data});}catch(e){clearTimeout(timer);this.pending.delete(id);reject(e);}});}
  async start(){const r=await this.ready;if(r.supportedProtocolVersions?.includes(2))await this.request('negotiate_protocol',{protocolVersion:2});return this;}
  async close(){if(this.closed)return;this.child.stdin.end();await new Promise(resolve=>{const timer=setTimeout(()=>{this.child.kill('SIGTERM');resolve();},3000);this.child.once('exit',()=>{clearTimeout(timer);resolve();});});}
}
