CREATE TABLE dbo.cms_settings(tenant nvarchar(200) PRIMARY KEY,settings nvarchar(max) NOT NULL,version int NOT NULL);
CREATE TABLE dbo.cms_media(tenant nvarchar(200) NOT NULL,id nvarchar(36) NOT NULL,name nvarchar(200) NOT NULL,mime nvarchar(100) NOT NULL,content nvarchar(max) NOT NULL,created_at nvarchar(40) NOT NULL,CONSTRAINT PK_cms_media PRIMARY KEY(tenant,id));
