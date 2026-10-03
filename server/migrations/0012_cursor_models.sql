-- Cursor's own models as last offered by its server, and whether each is passed on to Cursor.
CREATE TABLE cursor_models (
    name TEXT PRIMARY KEY NOT NULL,
    display_name TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1))
);
