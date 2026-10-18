SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF EXISTS(SELECT 1 FROM dbo.schema_migrations WHERE version=6) BEGIN COMMIT; RETURN; END;
CREATE TABLE dbo.application_users(tenant nvarchar(64) NOT NULL,oid nvarchar(64) NOT NULL,display_name nvarchar(200) NOT NULL,active bit NOT NULL,role_limit varchar(16) NULL CHECK(role_limit IN ('Admin','Foreman')),entra_admin bit NOT NULL,version int NOT NULL,created_at nvarchar(30) NOT NULL,seen_at nvarchar(30),PRIMARY KEY(tenant,oid));
CREATE TABLE dbo.user_access_changes(id uniqueidentifier PRIMARY KEY,tenant nvarchar(64) NOT NULL,oid nvarchar(64) NOT NULL,before_json nvarchar(max) NOT NULL CHECK(ISJSON(before_json)=1),after_json nvarchar(max) NOT NULL CHECK(ISJSON(after_json)=1),reason nvarchar(2000) NOT NULL,actor nvarchar(64) NOT NULL,created_at nvarchar(30) NOT NULL);
CREATE INDEX user_access_history ON dbo.user_access_changes(tenant,oid,created_at);
INSERT dbo.schema_migrations(version) VALUES(6);
COMMIT;
