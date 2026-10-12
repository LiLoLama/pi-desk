// MCP OAuth credentials in OMP's own store (agent.db, auth_credentials, schema 8). OMP looks rows up by server URL and refreshes them itself.
import {DatabaseSync} from 'node:sqlite';import {existsSync} from 'node:fs';import path from 'node:path';
export const SCHEMA_VERSION=8;
export const credentialKey=url=>`mcp_oauth:profile:${process.env.OMP_PROFILE||'default'}:${url}`;
export class StorageMismatch extends Error{constructor(){super('Diese OMP-Version speichert Anmeldungen anders. Bitte Pi Desk aktualisieren.');}}
export class McpCredentials{
 constructor(agentDir){this.file=path.join(agentDir,'agent.db');}
 exists(){return existsSync(this.file);}
 #open(){const db=new DatabaseSync(this.file);db.exec('PRAGMA busy_timeout = 5000');return db;}
 #check(db){
  const columns=new Set(db.prepare('PRAGMA table_info(auth_credentials)').all().map(c=>c.name));let version;
  try{version=db.prepare('SELECT version FROM auth_schema_version').get()?.version;}catch{}
  if(!['provider','credential_type','data','disabled_cause','updated_at'].every(c=>columns.has(c))||version!==SCHEMA_VERSION)throw new StorageMismatch();
 }
 status(url){
  if(!this.exists())return 'none';let db;
  try{db=this.#open();const rows=db.prepare("SELECT disabled_cause FROM auth_credentials WHERE provider=? AND credential_type='oauth'").all(credentialKey(url));return !rows.length?'none':rows.some(r=>r.disabled_cause===null)?'signed-in':'expired';}
  catch{return 'none';}finally{db?.close();}
 }
 save(url,credential){
  const db=this.#open();
  try{this.#check(db);db.exec('BEGIN IMMEDIATE');
   try{db.prepare("UPDATE auth_credentials SET disabled_cause='replaced by newer credential', updated_at=CAST(strftime('%s','now') AS INTEGER) WHERE provider=? AND disabled_cause IS NULL").run(credentialKey(url));
    db.prepare("INSERT INTO auth_credentials (provider, credential_type, data) VALUES (?, 'oauth', ?)").run(credentialKey(url),JSON.stringify(credential));db.exec('COMMIT');}
   catch(e){db.exec('ROLLBACK');throw e;}
  }finally{db.close();}
 }
 remove(url){if(!this.exists())return;const db=this.#open();try{this.#check(db);db.prepare('DELETE FROM auth_credentials WHERE provider=?').run(credentialKey(url));}finally{db.close();}}
 snapshot(targetDir){if(!this.exists())return false;const db=this.#open();try{db.prepare('VACUUM INTO ?').run(path.join(targetDir,'agent.db'));return true;}finally{db.close();}}
}
