// User-facing release notes: CHANGELOG.md sections "## X.Y.Z – DD.MM.YYYY".
const heading=/^## (\d+\.\d+\.\d+)(?:\s+[–—-]\s+(.+?))?\s*$/;
function parseChangelog(text){
 const entries=[];let current=null;
 for(const line of String(text??'').split(/\r?\n/)){const match=line.match(heading);if(match){current={version:match[1],date:match[2]||'',lines:[]};entries.push(current);}else if(current)current.lines.push(line);}
 return entries.map(({lines,...entry})=>({...entry,body:lines.join('\n').trim()}));
}
function compareVersions(a,b){const left=String(a).split('.').map(Number),right=String(b).split('.').map(Number);for(let i=0;i<3;i++){const l=left[i]||0,r=right[i]||0;if(l!==r)return l>r?1:-1;}return 0;}
const sectionsNewerThan=(entries,installed)=>entries.filter(e=>compareVersions(e.version,installed)>0).sort((a,b)=>compareVersions(b.version,a.version));
const renderNotes=entries=>entries.map(e=>`## ${e.version}${e.date?` – ${e.date}`:''}\n\n${e.body}`).join('\n\n');
function section(text,version){const entry=parseChangelog(text).find(e=>e.version===version);if(!entry?.body)throw Error(`CHANGELOG.md enthält keinen Abschnitt für ${version}.`);return entry;}
module.exports={parseChangelog,compareVersions,sectionsNewerThan,renderNotes,section};
