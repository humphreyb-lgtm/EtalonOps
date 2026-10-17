SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF EXISTS(SELECT 1 FROM dbo.schema_migrations WHERE version=3) BEGIN COMMIT; RETURN; END;
ALTER TABLE dbo.translations ADD source_url nvarchar(2000);
INSERT dbo.schema_migrations(version) VALUES(3);
COMMIT;
