-- =====================================================================
-- Avatars (storage policies on chat-media bucket) + per-message read
-- receipts table for both DM and group (club) rooms.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Storage policies for avatar uploads under chat-media/avatars/{uid}/
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'chat_media_avatars_insert_own'
  ) THEN
    CREATE POLICY chat_media_avatars_insert_own ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'chat-media'
        AND (storage.foldername(name))[1] = 'avatars'
        AND (storage.foldername(name))[2] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'chat_media_avatars_update_own'
  ) THEN
    CREATE POLICY chat_media_avatars_update_own ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = 'chat-media'
        AND (storage.foldername(name))[1] = 'avatars'
        AND (storage.foldername(name))[2] = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'chat-media'
        AND (storage.foldername(name))[1] = 'avatars'
        AND (storage.foldername(name))[2] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'chat_media_avatars_delete_own'
  ) THEN
    CREATE POLICY chat_media_avatars_delete_own ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'chat-media'
        AND (storage.foldername(name))[1] = 'avatars'
        AND (storage.foldername(name))[2] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'chat_media_avatars_select_public'
  ) THEN
    CREATE POLICY chat_media_avatars_select_public ON storage.objects
      FOR SELECT TO public
      USING (
        bucket_id = 'chat-media'
        AND (storage.foldername(name))[1] = 'avatars'
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2. message_reads table (covers both DM and club messages)
-- ---------------------------------------------------------------------
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

ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Insert: user can only mark their own reads
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'message_reads' AND policyname = 'message_reads_insert_own'
  ) THEN
    CREATE POLICY message_reads_insert_own ON message_reads
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  -- Update: user can only update their own
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'message_reads' AND policyname = 'message_reads_update_own'
  ) THEN
    CREATE POLICY message_reads_update_own ON message_reads
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  -- Select: room participants can read
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'message_reads' AND policyname = 'message_reads_select_participants'
  ) THEN
    CREATE POLICY message_reads_select_participants ON message_reads
      FOR SELECT TO authenticated
      USING (
        user_id = auth.uid()
        OR (
          room_type = 'dm'
          AND EXISTS (
            SELECT 1 FROM dm_rooms r
            WHERE r.id = message_reads.room_id
              AND (r.participant_1_id = auth.uid() OR r.participant_2_id = auth.uid())
          )
        )
        OR (
          room_type = 'club'
          AND EXISTS (
            SELECT 1 FROM club_members m
            WHERE m.club_id = message_reads.room_id AND m.user_id = auth.uid()
          )
        )
      );
  END IF;
END $$;

-- Enable realtime publication for message_reads
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE message_reads;
    EXCEPTION WHEN duplicate_object THEN
      -- already a member of the publication
      NULL;
    END;
  END IF;
END $$;
