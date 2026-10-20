SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF EXISTS(SELECT 1 FROM dbo.schema_migrations WHERE version=13) BEGIN COMMIT; RETURN; END;
ALTER TABLE dbo.drafts ADD form_json nvarchar(max) NOT NULL CONSTRAINT DF_drafts_form_json DEFAULT '{}';
CREATE TABLE dbo.pdf_templates(tenant nvarchar(200) NOT NULL PRIMARY KEY,config nvarchar(max) NOT NULL,version int NOT NULL);
INSERT dbo.schema_migrations(version) VALUES(13);
COMMIT;
