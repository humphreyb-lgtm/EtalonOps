SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF EXISTS(SELECT 1 FROM dbo.schema_migrations WHERE version=16) BEGIN COMMIT; RETURN; END;
ALTER TABLE dbo.manual_item_reports ADD line_id uniqueidentifier NULL;
INSERT dbo.schema_migrations(version) VALUES(16);
COMMIT;
