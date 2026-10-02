import test from 'node:test';
import assert from 'node:assert/strict';
import {applyMessageFrame,combinedQueue,deferredMcpNames,normalizeQueuedMessages,promptLifecycle} from '../rpc-contract.mjs';

test('OMP 18.4 RPC message identity, queue and lifecycle stay coherent',()=>{
 const messages=[],indexes=new Map();
 applyMessageFrame(messages,indexes,{type:'message_start',messageId:'a',message:{role:'assistant',content:'A0'}});
 applyMessageFrame(messages,indexes,{type:'message_start',messageId:'b',message:{role:'assistant',content:'B0'}});
 applyMessageFrame(messages,indexes,{type:'message_update',messageId:'a',message:{role:'assistant',content:'A1'}});
 assert.deepEqual(messages.map(m=>m.content),['A1','B0']);
 assert.deepEqual(normalizeQueuedMessages({steering:[' now '],followUp:['later']}),{steering:['now'],followUp:['later']});
 const queue=combinedQueue([{id:'local',kind:'follow-up',text:'later'}],{steering:['now'],followUp:['later']},new Set());
 assert.equal(queue.length,2);assert.equal(queue[1].kind,'steer');
 let state=promptLifecycle({busy:true,error:'',modern:false},{type:'agent_end',isTerminal:true,yielded:true});assert.equal(state.busy,true);
 state=promptLifecycle(state,{type:'prompt_result',agentInvoked:true,status:'error',error:{message:'kaputt'},sessionSettled:true});assert.equal(state.busy,false);assert.equal(state.error,'kaputt');
});

test('deferred MCP routes survive old and OMP 18.4 prompt prose',()=>{
 const names=deferredMcpNames({dumpTools:[{name:'mcp__dump_tool'}],systemPrompt:[
  '- xd://mcp__old_proof — old',
  '- "proof" → `xd://mcp__fixture_proof` — Return proof.'
 ]});
 assert.deepEqual(new Set(names),new Set(['mcp__dump_tool','mcp__old_proof','mcp__fixture_proof']));
});
