import test from 'node:test';
import assert from 'node:assert/strict';
import {syncRpcMessage,queueFromSnapshot,rpcStateBusy} from '../rpc-contract.mjs';

test('RPC messageId keeps interleaved same-role messages distinct',()=>{
 const messages=[],ids=new Map();
 syncRpcMessage(messages,ids,{type:'message_start',messageId:'a',message:{role:'assistant',content:'A0'}});
 syncRpcMessage(messages,ids,{type:'message_start',messageId:'b',message:{role:'assistant',content:'B0'}});
 syncRpcMessage(messages,ids,{type:'message_update',messageId:'a',message:{role:'assistant',content:'A1'}});
 syncRpcMessage(messages,ids,{type:'message_end',messageId:'b',message:{role:'assistant',content:'B1'}});
 assert.deepEqual(messages.map(m=>m.content),['A1','B1']);
});

test('OMP queue snapshots preserve ids and settled state includes async work',()=>{
 let n=0;const previous=[{id:'kept',kind:'follow-up',text:'later'}];
 const next=queueFromSnapshot(previous,{steering:['now'],followUp:['later']},()=>`new-${++n}`);
 assert.deepEqual(next,[{id:'new-1',kind:'steer',text:'now'},{id:'kept',kind:'follow-up',text:'later'}]);
 assert.equal(rpcStateBusy({isSettled:true,isStreaming:false,hasPendingAsyncWork:false}),false);
 assert.equal(rpcStateBusy({isSettled:false,isStreaming:false,hasPendingAsyncWork:false}),true);
 assert.equal(rpcStateBusy({isSettled:true,isStreaming:false,hasPendingAsyncWork:true}),true);
});
