-- =====================================================================
-- Add client_message_id for idempotency and offline-first support
-- This prevents duplicate messages when network is flaky
-- =====================================================================

-- Add client_message_id to dm_messages
ALTER TABLE dm_messages
ADD COLUMN IF NOT EXISTS client_message_id UUID UNIQUE;

-- Add client_message_id to club_messages
ALTER TABLE club_messages
ADD COLUMN IF NOT EXISTS client_message_id UUID UNIQUE;

-- Create indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_dm_messages_client_id
ON dm_messages (client_message_id)
WHERE client_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_club_messages_client_id
ON club_messages (client_message_id)
WHERE client_message_id IS NOT NULL;

-- Enable realtime for the new columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE dm_messages;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE club_messages;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;
