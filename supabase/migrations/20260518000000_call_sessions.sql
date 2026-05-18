-- Call sessions for voice/video signaling (LiveKit media runs separately)

CREATE TYPE call_room_type AS ENUM ('dm', 'club');
CREATE TYPE call_media_type AS ENUM ('audio', 'video');
CREATE TYPE call_session_status AS ENUM ('ringing', 'active', 'ended', 'declined', 'missed');

CREATE TABLE IF NOT EXISTS call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type call_room_type NOT NULL,
  room_id UUID NOT NULL,
  call_type call_media_type NOT NULL,
  status call_session_status NOT NULL DEFAULT 'ringing',
  caller_id UUID NOT NULL,
  livekit_room TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_room ON call_sessions(room_type, room_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_status ON call_sessions(status);
CREATE INDEX IF NOT EXISTS idx_call_sessions_created ON call_sessions(created_at DESC);

-- Only one active/ringing call per chat room at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_call_sessions_active_room
  ON call_sessions(room_type, room_id)
  WHERE status IN ('ringing', 'active');

ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;

-- DM: participants can read/write sessions for their room
CREATE POLICY call_sessions_dm_select ON call_sessions
  FOR SELECT
  USING (
    room_type = 'dm'
    AND EXISTS (
      SELECT 1 FROM dm_rooms dr
      WHERE dr.id = call_sessions.room_id
        AND (dr.participant_1_id = auth.uid() OR dr.participant_2_id = auth.uid())
    )
  );

CREATE POLICY call_sessions_dm_insert ON call_sessions
  FOR INSERT
  WITH CHECK (
    room_type = 'dm'
    AND caller_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM dm_rooms dr
      WHERE dr.id = room_id
        AND (dr.participant_1_id = auth.uid() OR dr.participant_2_id = auth.uid())
    )
  );

CREATE POLICY call_sessions_dm_update ON call_sessions
  FOR UPDATE
  USING (
    room_type = 'dm'
    AND EXISTS (
      SELECT 1 FROM dm_rooms dr
      WHERE dr.id = call_sessions.room_id
        AND (dr.participant_1_id = auth.uid() OR dr.participant_2_id = auth.uid())
    )
  );

-- Club: members can read/write sessions for their club
CREATE POLICY call_sessions_club_select ON call_sessions
  FOR SELECT
  USING (
    room_type = 'club'
    AND EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = call_sessions.room_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY call_sessions_club_insert ON call_sessions
  FOR INSERT
  WITH CHECK (
    room_type = 'club'
    AND caller_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = room_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY call_sessions_club_update ON call_sessions
  FOR UPDATE
  USING (
    room_type = 'club'
    AND EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.club_id = call_sessions.room_id
        AND cm.user_id = auth.uid()
    )
  );

-- Enable Realtime (run in Supabase Dashboard if this fails)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE call_sessions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
