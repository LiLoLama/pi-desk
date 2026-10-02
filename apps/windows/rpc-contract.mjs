// OMP 18.4 RPC compatibility helpers kept independent for focused contract tests.
export function applyMessageFrame(messages,messageIndexes,frame){
 if(!['message_start','message_update','message_end'].includes(frame?.type)||!frame.message)return false;
 const id=typeof frame.messageId==='string'&&frame.messageId?frame.messageId:'';let index=id?messageIndexes.get(id):undefined;
 if(!Number.isInteger(index)||index<0||index>=messages.length)index=undefined;
 if(frame.type==='message_start'){if(index===undefined){index=messages.length;messages.push(frame.message);}else messages[index]=frame.message;if(id)messageIndexes.set(id,index);return true;}
 if(index===undefined)for(let i=messages.length-1;i>=0;i--)if(messages[i]?.role===frame.message.role){index=i;break;}
 if(index===undefined){index=messages.length;messages.push(frame.message);}else messages[index]=frame.message;
 if(id)messageIndexes.set(id,index);if(frame.type==='message_end'&&id)messageIndexes.delete(id);return true;
}
export function normalizeQueuedMessages(value){const clean=list=>Array.isArray(list)?list.filter(text=>typeof text==='string'&&text.trim()).map(text=>text.trim()):[];return {steering:clean(value?.steering),followUp:clean(value?.followUp)};}
function queueId(queue,text,occurrence){return `omp:${queue}:${occurrence}:${Buffer.from(text).toString('base64url')}`;}
export function combinedQueue(localQueue=[],queuedMessages={},removableLocalIds=new Set()){
 const result=localQueue.map(item=>({...item}));const unmatched=result.filter(item=>!removableLocalIds.has(item.id)).map(item=>({kind:item.kind,text:item.text,used:false}));
 for(const [queue,kind] of [['steering','steer'],['followUp','follow-up']]){const occurrences=new Map();for(const text of normalizeQueuedMessages(queuedMessages)[queue]){const existing=unmatched.find(item=>!item.used&&item.kind===kind&&item.text===text);if(existing){existing.used=true;continue;}const occurrence=occurrences.get(text)||0;occurrences.set(text,occurrence+1);result.push({id:queueId(queue,text,occurrence),kind,text,source:'omp',ompQueue:queue});}}
 return result;
}
export function promptLifecycle(state,frame){
 const next={...state};if(frame?.type==='agent_start')next.busy=true;
 if(frame?.type==='agent_end'){next.refresh=true;next.legacyYield=frame.isTerminal!==false&&frame.yielded!==false;}
 if(frame?.type==='prompt_result'){next.modern=true;next.legacyYield=false;if(frame.status==='error')next.error=typeof frame.error==='string'?frame.error:frame.error?.message||'OMP-Auftrag fehlgeschlagen';if(frame.sessionSettled===true||frame.agentInvoked===false)next.busy=false;}
 if(frame?.type==='session_settled'){next.modern=true;next.legacyYield=false;next.busy=false;}return next;
}
export function deferredMcpNames(state){
 const names=new Set((Array.isArray(state?.dumpTools)?state.dumpTools:[]).filter(tool=>typeof tool?.name==='string'&&tool.name.startsWith('mcp__')).map(tool=>tool.name));
 const prompt=Array.isArray(state?.systemPrompt)?state.systemPrompt.join('\n'):String(state?.systemPrompt||'');
 for(const match of prompt.matchAll(/(?:^|\s|`)xd:\/\/(mcp__[A-Za-z0-9_-]+)(?=`|\s|$)/gm))names.add(match[1]);return [...names];
}
