-- Store disables foreign keys for this table rebuild, inside an immediate transaction.
CREATE TABLE drafts_next(id TEXT PRIMARY KEY,tenant TEXT NOT NULL,owner TEXT NOT NULL,project TEXT NOT NULL,delivery_date TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL,name TEXT NOT NULL DEFAULT 'Untitled MRF');
INSERT INTO drafts_next(id,tenant,owner,project,delivery_date,version,updated_at,name) SELECT id,tenant,owner,project,delivery_date,version,updated_at,'Saved MRF - '||project||' - '||delivery_date FROM drafts;
DROP TABLE drafts;
ALTER TABLE drafts_next RENAME TO drafts;
CREATE INDEX draft_owner_list ON drafts(tenant,owner,project,updated_at,id);
