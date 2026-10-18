SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF EXISTS(SELECT 1 FROM dbo.schema_migrations WHERE version=7) BEGIN COMMIT; RETURN; END;
CREATE TABLE dbo.mrf_submissions(id uniqueidentifier PRIMARY KEY,tenant nvarchar(64) NOT NULL,owner nvarchar(64) NOT NULL,project nvarchar(64) NOT NULL,draft_id uniqueidentifier NOT NULL UNIQUE REFERENCES dbo.drafts(id),draft_version int NOT NULL,mrf_number int NOT NULL,revision int NOT NULL,previous_id uniqueidentifier REFERENCES dbo.mrf_submissions(id),request_id uniqueidentifier NOT NULL,preview_hash char(64) NOT NULL,snapshot nvarchar(max) NOT NULL CHECK(ISJSON(snapshot)=1),warnings nvarchar(max) NOT NULL CHECK(ISJSON(warnings)=1),submitted_at nvarchar(30) NOT NULL,UNIQUE(tenant,request_id),UNIQUE(tenant,mrf_number,revision));
CREATE INDEX submission_owner_list ON dbo.mrf_submissions(tenant,owner,project,submitted_at,id);
ALTER TABLE dbo.drafts ADD revision_of uniqueidentifier NULL REFERENCES dbo.mrf_submissions(id);
EXEC sys.sp_executesql N'CREATE UNIQUE INDEX draft_revision_source ON dbo.drafts(tenant,owner,revision_of) WHERE revision_of IS NOT NULL;';
INSERT dbo.schema_migrations(version) VALUES(7);
COMMIT;
