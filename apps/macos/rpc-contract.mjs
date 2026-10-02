export function syncRpcMessage(messages,messageIds,frame){
 const message=frame?.message;if(!message)return false;
 const key=typeof frame.messageId==='string'?frame.messageId:'';
 if(frame.type==='message_start'){
  const known=key?messageIds.get(key):undefined;
  if(known===undefined){messages.push(message);if(key)messageIds.set(key,messages.length-1);return true;}
  messages[known]=message;return false;
 }
 if(!['message_update','message_end'].includes(frame.type))return false;
 const known=key?messageIds.get(key):undefined;
 if(known!==undefined){messages[known]=message;return false;}
 const last=messages.length-1;
 if(last>=0&&messages[last].role===message.role){messages[last]=message;if(key)messageIds.set(key,last);return false;}
 messages.push(message);if(key)messageIds.set(key,messages.length-1);return true;
}
export function queueFromSnapshot(previous,snapshot,makeId){
 if(!snapshot||!Array.isArray(snapshot.steering)||!Array.isArray(snapshot.followUp))return null;
 const remaining=[...(previous||[])],next=[];
 for(const [kind,texts] of [['steer',snapshot.steering],['follow-up',snapshot.followUp]])for(const text of texts){
  const index=remaining.findIndex(item=>item.kind===kind&&item.text===text);
  next.push(index<0?{id:makeId(),kind,text}:remaining.splice(index,1)[0]);
 }
 return next;
}
export function rpcStateBusy(state){
 return state?.isSettled===false||state?.isStreaming===true||state?.hasPendingAsyncWork===true;
}
