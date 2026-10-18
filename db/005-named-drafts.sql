SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF EXISTS(SELECT 1 FROM dbo.schema_migrations WHERE version=5) BEGIN COMMIT; RETURN; END;
ALTER TABLE dbo.drafts DROP CONSTRAINT UQ_owner_project_draft;
ALTER TABLE dbo.drafts ADD name nvarchar(120) NOT NULL CONSTRAINT DF_draft_name DEFAULT 'Untitled MRF';
EXEC sys.sp_executesql N'UPDATE dbo.drafts SET name=CONCAT(''Saved MRF - '',project,'' - '',CONVERT(varchar(10),delivery_date,23));';
CREATE INDEX draft_owner_list ON dbo.drafts(tenant,owner,project,updated_at,id);
INSERT dbo.schema_migrations(version) VALUES(5);
COMMIT;
