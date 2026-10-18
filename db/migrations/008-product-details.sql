ALTER TABLE manufacturer_products ADD COLUMN details_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(details_json));
