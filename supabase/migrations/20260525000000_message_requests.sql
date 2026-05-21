-- Create message_requests table to track new and spam message requests
CREATE TABLE IF NOT EXISTS message_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES dm_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('new', 'accepted', 'spam', 'deleted')),
  first_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_message_requests_user_id ON message_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_message_requests_status ON message_requests(status);
CREATE INDEX IF NOT EXISTS idx_message_requests_user_status ON message_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_message_requests_room_id ON message_requests(room_id);

-- Enable RLS
ALTER TABLE message_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own message requests
CREATE POLICY "Users can view own message requests"
  ON message_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert message requests for themselves (when receiving messages)
CREATE POLICY "Users can insert own message requests"
  ON message_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own message requests
CREATE POLICY "Users can update own message requests"
  ON message_requests FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own message requests
CREATE POLICY "Users can delete own message requests"
  ON message_requests FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_message_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on row update
CREATE TRIGGER update_message_requests_updated_at
  BEFORE UPDATE ON message_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_message_requests_updated_at();

-- Function to create message request when first message is sent in a DM room
CREATE OR REPLACE FUNCTION create_message_request_on_first_message()
RETURNS TRIGGER AS $$
DECLARE
  recipient_id UUID;
  existing_request_id UUID;
  message_count INTEGER;
BEGIN
  -- Determine the recipient (the other participant in the room)
  SELECT 
    CASE 
      WHEN participant_1_id = NEW.user_id THEN participant_2_id
      ELSE participant_1_id
    END INTO recipient_id
  FROM dm_rooms
  WHERE id = NEW.room_id;

  -- Check if this is truly the first message from this sender to this recipient
  SELECT COUNT(*) INTO message_count
  FROM dm_messages
  WHERE room_id = NEW.room_id AND user_id = NEW.user_id;

  -- Only create message request if this is the first message
  IF message_count = 1 THEN
    -- Check if a message request already exists
    SELECT id INTO existing_request_id
    FROM message_requests
    WHERE room_id = NEW.room_id AND user_id = recipient_id;

    IF existing_request_id IS NULL THEN
      -- Create new message request
      INSERT INTO message_requests (room_id, user_id, sender_id, status, first_message_at)
      VALUES (NEW.room_id, recipient_id, NEW.user_id, 'new', NEW.created_at);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create message request on first DM message
CREATE TRIGGER create_message_request_on_first_dm_message
  AFTER INSERT ON dm_messages
  FOR EACH ROW
  EXECUTE FUNCTION create_message_request_on_first_message();
