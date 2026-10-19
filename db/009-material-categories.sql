SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF EXISTS(SELECT 1 FROM dbo.schema_migrations WHERE version=9) BEGIN COMMIT; RETURN; END;
CREATE TABLE dbo.material_categories(tenant nvarchar(64) NOT NULL,id varchar(60) NOT NULL,name nvarchar(100) NOT NULL,normalized nvarchar(100) NOT NULL,fields_json nvarchar(max) NOT NULL,version int NOT NULL,PRIMARY KEY(tenant,id),UNIQUE(tenant,normalized),CHECK(ISJSON(fields_json)=1));
INSERT dbo.schema_migrations(version) VALUES(9);
COMMIT;
