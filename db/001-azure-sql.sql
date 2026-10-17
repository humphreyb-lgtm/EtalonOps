-- SQL Server / Azure SQL schema. Engine-validation evidence is recorded in docs.
-- Local engine tests do not establish an Azure deployment or managed identity.
-- Run through a migration identity; the runtime application cannot execute DDL.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID('dbo.schema_migrations') IS NULL
  CREATE TABLE dbo.schema_migrations(version int PRIMARY KEY, applied_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
IF EXISTS(SELECT 1 FROM dbo.schema_migrations WHERE version=1)
BEGIN
  COMMIT;
  RETURN;
END;
CREATE TABLE dbo.memberships(
  tenant nvarchar(64) NOT NULL, owner nvarchar(64) NOT NULL, project nvarchar(64) NOT NULL,
  CONSTRAINT PK_memberships PRIMARY KEY(tenant,owner,project)
);
CREATE TABLE dbo.import_batches(
  id uniqueidentifier PRIMARY KEY, tenant nvarchar(64) NOT NULL, hash char(64) NOT NULL,
  state varchar(16) NOT NULL CHECK(state IN ('preview','applied','rolled_back')),
  [file] nvarchar(max) NOT NULL, report nvarchar(max) NOT NULL CHECK(ISJSON(report)=1),
  reviewer nvarchar(64), approved_at datetime2, CONSTRAINT UQ_batch_hash UNIQUE(tenant,hash)
);
CREATE TABLE dbo.materials(
  id uniqueidentifier PRIMARY KEY, tenant nvarchar(64) NOT NULL, external_key nvarchar(100) NOT NULL,
  description nvarchar(2000) NOT NULL, product_uom varchar(8) NOT NULL CHECK(product_uom IN ('EA','FT','STICK','BOX','ROLL','PAIR')),
  details nvarchar(max) NOT NULL CHECK(ISJSON(details)=1),
  dataset_kind varchar(16) NOT NULL CHECK(dataset_kind IN ('fixture','reviewed')),
  batch_id uniqueidentifier NOT NULL REFERENCES dbo.import_batches(id), active bit NOT NULL DEFAULT 1,
  CONSTRAINT UQ_material_key UNIQUE(tenant,external_key)
);
CREATE INDEX material_tenant ON dbo.materials(tenant,active);
CREATE TABLE dbo.aliases(
  material_id uniqueidentifier NOT NULL REFERENCES dbo.materials(id), normalized nvarchar(200) NOT NULL,
  requested_uom varchar(8) NOT NULL CHECK(requested_uom IN ('EA','FT','STICK','BOX','ROLL','PAIR')),
  CONSTRAINT PK_aliases PRIMARY KEY(material_id,normalized)
);
CREATE INDEX alias_search ON dbo.aliases(normalized);
CREATE TABLE dbo.drafts(
  id uniqueidentifier PRIMARY KEY, tenant nvarchar(64) NOT NULL, owner nvarchar(64) NOT NULL,
  project nvarchar(64) NOT NULL, delivery_date date NOT NULL, version int NOT NULL CHECK(version>0),
  updated_at datetime2 NOT NULL, concurrency_stamp rowversion,
  CONSTRAINT UQ_owner_project_draft UNIQUE(tenant,owner,project)
);
CREATE TABLE dbo.draft_lines(
  id uniqueidentifier NOT NULL, draft_id uniqueidentifier NOT NULL REFERENCES dbo.drafts(id) ON DELETE CASCADE,
  position int NOT NULL CHECK(position>=0), material_id uniqueidentifier REFERENCES dbo.materials(id),
  quantity nvarchar(24) NOT NULL CHECK(TRY_CONVERT(decimal(18,6),quantity)>0 AND TRY_CONVERT(decimal(18,6),quantity) IS NOT NULL),
  requested_uom varchar(8) NOT NULL CHECK(requested_uom IN ('EA','FT','STICK','BOX','ROLL','PAIR')),
  description nvarchar(2000) NOT NULL, raw_input nvarchar(max) NOT NULL CHECK(ISJSON(raw_input)=1),
  candidate nvarchar(max) CHECK(candidate IS NULL OR ISJSON(candidate)=1),
  source varchar(32) NOT NULL CHECK(source IN ('verified','verified_fixture','ai_fixture','user_description')),
  delivery_mode varchar(8) NOT NULL CHECK(delivery_mode IN ('inherit','override')), override_date date,
  CONSTRAINT PK_draft_lines PRIMARY KEY(draft_id,id),
  CONSTRAINT CK_delivery_mode CHECK((delivery_mode='inherit' AND override_date IS NULL) OR (delivery_mode='override' AND override_date IS NOT NULL))
);
CREATE TABLE dbo.audit_events(
  id uniqueidentifier PRIMARY KEY, tenant nvarchar(64) NOT NULL, actor nvarchar(64) NOT NULL,
  action nvarchar(100) NOT NULL, target nvarchar(100) NOT NULL, at datetime2 NOT NULL
);
CREATE TABLE dbo.image_associations(
  id uniqueidentifier PRIMARY KEY, tenant nvarchar(64) NOT NULL,
  material_id uniqueidentifier NOT NULL REFERENCES dbo.materials(id), content_hash char(64) NOT NULL,
  source_url nvarchar(2000) NOT NULL, rights_basis nvarchar(2000) NOT NULL,
  status varchar(8) NOT NULL CHECK(status IN ('pending','approved','rejected')),
  reviewer nvarchar(64), reviewed_at datetime2,
  CONSTRAINT UQ_image_product UNIQUE(tenant,material_id,content_hash)
);
INSERT dbo.schema_migrations(version) VALUES(1);
COMMIT;
