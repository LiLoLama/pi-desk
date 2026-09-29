const isLocal=(url,origin)=>{try{return new URL(url).origin===origin;}catch{return false;}};
const externalURL=value=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}};
module.exports={isLocal,externalURL};
