SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF EXISTS(SELECT 1 FROM dbo.schema_migrations WHERE version=10) BEGIN COMMIT; RETURN; END;
ALTER TABLE dbo.drafts ADD foreman_oid nvarchar(64) NULL,foreman_name nvarchar(200) NULL;
INSERT dbo.schema_migrations(version) VALUES(10);
COMMIT;
