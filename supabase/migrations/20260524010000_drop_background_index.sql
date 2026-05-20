-- =====================================================================
-- Drop indexes on background_value
--
-- background_value can hold large base64 image data URLs that exceed the
-- btree index row limit (8191 bytes), causing UPDATE/INSERT to fail with
-- "index row requires N bytes, maximum size is 8191".
--
-- These indexes were never useful for query patterns anyway (we never
-- filter rooms by background_value).
-- =====================================================================

DROP INDEX IF EXISTS idx_dm_rooms_background;
DROP INDEX IF EXISTS idx_clubs_background;

-- Optionally keep a lightweight index on background_type only, in case
-- you ever query "rooms with custom background".
CREATE INDEX IF NOT EXISTS idx_dm_rooms_background_type
  ON dm_rooms (background_type);
CREATE INDEX IF NOT EXISTS idx_clubs_background_type
  ON clubs (background_type);
