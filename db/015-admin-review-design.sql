SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF EXISTS(SELECT 1 FROM dbo.schema_migrations WHERE version=15) BEGIN COMMIT; RETURN; END;
CREATE TABLE dbo.manual_item_reports(tenant nvarchar(200) NOT NULL,id uniqueidentifier NOT NULL,actor nvarchar(200) NOT NULL,project nvarchar(64) NOT NULL,draft_id uniqueidentifier NULL,search_phrase nvarchar(2000) NOT NULL,description nvarchar(2000) NOT NULL,quantity nvarchar(30) NOT NULL,unit nvarchar(10) NOT NULL,status nvarchar(20) NOT NULL DEFAULT 'pending',material_id uniqueidentifier NULL,resolution nvarchar(1000) NOT NULL DEFAULT '',reviewer nvarchar(200) NULL,created_at nvarchar(40) NOT NULL,reviewed_at nvarchar(40) NULL,version int NOT NULL DEFAULT 1,PRIMARY KEY(tenant,id));
CREATE INDEX manual_item_reports_status ON dbo.manual_item_reports(tenant,status,created_at);
CREATE TABLE dbo.design_settings(tenant nvarchar(200) PRIMARY KEY,settings nvarchar(max) NOT NULL,version int NOT NULL,updated_by nvarchar(200) NOT NULL,updated_at nvarchar(40) NOT NULL);
INSERT dbo.schema_migrations(version) VALUES(15);
COMMIT;
