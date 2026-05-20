-- =====================================================================
-- Chat Themes: Add theme_color to dm_rooms and clubs tables
-- =====================================================================

-- Add theme_color column to dm_rooms
ALTER TABLE dm_rooms
ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT '#0A7CFF';

-- Add theme_color column to clubs
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT '#0A7CFF';

-- Create index for faster theme lookups
CREATE INDEX IF NOT EXISTS idx_dm_rooms_theme ON dm_rooms (id, theme_color);
CREATE INDEX IF NOT EXISTS idx_clubs_theme ON clubs (id, theme_color);

-- Enable realtime for theme updates on dm_rooms
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE dm_rooms;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

-- Enable realtime for theme updates on clubs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE clubs;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;
