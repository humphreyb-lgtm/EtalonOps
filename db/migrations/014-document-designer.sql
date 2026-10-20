CREATE TABLE document_templates(tenant TEXT NOT NULL,id TEXT NOT NULL,company_id TEXT,name TEXT NOT NULL,layout TEXT NOT NULL,version INTEGER NOT NULL,published_revision INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(tenant,id));
CREATE TABLE document_template_versions(tenant TEXT NOT NULL,template_id TEXT NOT NULL,revision INTEGER NOT NULL,name TEXT NOT NULL,company_id TEXT,layout TEXT NOT NULL,published_at TEXT NOT NULL,PRIMARY KEY(tenant,template_id,revision));
CREATE TABLE document_template_defaults(tenant TEXT NOT NULL,scope_key TEXT NOT NULL,template_id TEXT NOT NULL,PRIMARY KEY(tenant,scope_key));
CREATE TABLE company_logo_assets(tenant TEXT NOT NULL,id TEXT NOT NULL,company_id TEXT NOT NULL,content_hash TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(tenant,id));
CREATE TABLE company_logo_defaults(tenant TEXT NOT NULL,company_id TEXT NOT NULL,asset_id TEXT NOT NULL,PRIMARY KEY(tenant,company_id));
