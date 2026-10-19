SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF EXISTS(SELECT 1 FROM dbo.schema_migrations WHERE version=11) BEGIN COMMIT; RETURN; END;
ALTER TABLE dbo.draft_lines ADD task_code nvarchar(16) NULL;
INSERT dbo.schema_migrations(version) VALUES(11);
COMMIT;
