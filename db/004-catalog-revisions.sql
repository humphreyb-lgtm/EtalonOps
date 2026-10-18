SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF EXISTS(SELECT 1 FROM dbo.schema_migrations WHERE version=4) BEGIN COMMIT; RETURN; END;
CREATE TABLE dbo.catalog_revisions(id uniqueidentifier PRIMARY KEY,tenant nvarchar(64) NOT NULL,kind varchar(16) NOT NULL CHECK(kind IN ('material','product','merge')),entity_id uniqueidentifier NOT NULL,replacement_id uniqueidentifier,before_json nvarchar(max) NOT NULL CHECK(ISJSON(before_json)=1),after_json nvarchar(max) NOT NULL CHECK(ISJSON(after_json)=1),reason nvarchar(2000) NOT NULL,actor nvarchar(64) NOT NULL,created_at nvarchar(30) NOT NULL,request_key char(64) NOT NULL,UNIQUE(tenant,request_key));
CREATE INDEX catalog_revision_entity ON dbo.catalog_revisions(tenant,entity_id,created_at);
INSERT dbo.schema_migrations(version) VALUES(4);
COMMIT;
