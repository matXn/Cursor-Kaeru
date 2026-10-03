-- A model can be switched off without deleting it: it stays configured but is not offered to Cursor.
ALTER TABLE model_configs ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1));
