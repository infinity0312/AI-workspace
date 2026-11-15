ALTER TABLE assets ADD COLUMN export_rights text NOT NULL DEFAULT 'unknown'
  CHECK(export_rights IN ('user_owned','public_license','unknown','restricted'));
