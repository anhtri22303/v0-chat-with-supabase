-- =====================================================================
-- Complete Chat Themes: Add theme_color and background support
-- Run this in Supabase SQL Editor if migrations haven't been applied
-- =====================================================================

-- Ensure message_reads table exists (required for read receipts)
CREATE TABLE IF NOT EXISTS message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type TEXT NOT NULL CHECK (room_type IN ('dm', 'club')),
  room_id UUID NOT NULL,
  message_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_message_reads_room
  ON message_reads (room_type, room_id, message_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_user_room
  ON message_reads (room_type, room_id, user_id);

-- Add theme_color columns (from original migration)
ALTER TABLE dm_rooms
ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT '#0A7CFF';

ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT '#0A7CFF';

-- Add background columns
ALTER TABLE dm_rooms
ADD COLUMN IF NOT EXISTS background_type TEXT DEFAULT 'default' CHECK (background_type IN ('default', 'color', 'image')),
ADD COLUMN IF NOT EXISTS background_value TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS background_opacity REAL DEFAULT 1.0 CHECK (background_opacity >= 0 AND background_opacity <= 1);

ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS background_type TEXT DEFAULT 'default' CHECK (background_type IN ('default', 'color', 'image')),
ADD COLUMN IF NOT EXISTS background_value TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS background_opacity REAL DEFAULT 1.0 CHECK (background_opacity >= 0 AND background_opacity <= 1);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_dm_rooms_theme ON dm_rooms (id, theme_color);
CREATE INDEX IF NOT EXISTS idx_clubs_theme ON clubs (id, theme_color);
CREATE INDEX IF NOT EXISTS idx_dm_rooms_background ON dm_rooms (id, background_type, background_value);
CREATE INDEX IF NOT EXISTS idx_clubs_background ON clubs (id, background_type, background_value);

-- Enable realtime for dm_rooms
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

-- Enable realtime for clubs
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
