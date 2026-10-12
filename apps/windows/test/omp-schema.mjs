// agent.db tables as created by OMP 18.4.10 (auth_credentials, auth_schema_version), for tests without the runtime.
import {DatabaseSync} from 'node:sqlite';
export function ompSchema(file,version=8){
 const db=new DatabaseSync(file);
 db.exec(`CREATE TABLE auth_schema_version (id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL);
  INSERT INTO auth_schema_version (id, version) VALUES (1, ${Number(version)});
  CREATE TABLE auth_credentials (id INTEGER PRIMARY KEY AUTOINCREMENT, provider TEXT NOT NULL, credential_type TEXT NOT NULL, data TEXT NOT NULL, disabled_cause TEXT DEFAULT NULL, identity_key TEXT DEFAULT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch()));`);
 db.close();
}
