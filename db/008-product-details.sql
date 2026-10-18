SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF EXISTS(SELECT 1 FROM dbo.schema_migrations WHERE version=8) BEGIN COMMIT; RETURN; END;
ALTER TABLE dbo.manufacturer_products ADD details_json nvarchar(max) NOT NULL CONSTRAINT manufacturer_product_details_default DEFAULT '{}';
EXEC sys.sp_executesql N'ALTER TABLE dbo.manufacturer_products ADD CONSTRAINT manufacturer_product_details_json CHECK(ISJSON(details_json)=1);';
INSERT dbo.schema_migrations(version) VALUES(8);
COMMIT;
