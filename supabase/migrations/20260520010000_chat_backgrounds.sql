-- =====================================================================
-- Chat Backgrounds: Add background support to dm_rooms and clubs tables
-- =====================================================================

-- Add background columns to dm_rooms
ALTER TABLE dm_rooms
ADD COLUMN IF NOT EXISTS background_type TEXT DEFAULT 'default' CHECK (background_type IN ('default', 'color', 'image')),
ADD COLUMN IF NOT EXISTS background_value TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS background_opacity REAL DEFAULT 1.0 CHECK (background_opacity >= 0 AND background_opacity <= 1);

-- Add background columns to clubs
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS background_type TEXT DEFAULT 'default' CHECK (background_type IN ('default', 'color', 'image')),
ADD COLUMN IF NOT EXISTS background_value TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS background_opacity REAL DEFAULT 1.0 CHECK (background_opacity >= 0 AND background_opacity <= 1);

-- Create index for background lookups
CREATE INDEX IF NOT EXISTS idx_dm_rooms_background ON dm_rooms (id, background_type, background_value);
CREATE INDEX IF NOT EXISTS idx_clubs_background ON clubs (id, background_type, background_value);
