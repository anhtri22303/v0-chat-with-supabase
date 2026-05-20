-- =====================================================================
-- Theme/Background update RLS policies
-- Allow DM participants to update their dm_rooms row, and club members
-- (admin/owner) to update their clubs row. This lets the API routes use
-- the user-scoped Supabase client instead of the service-role admin client.
-- =====================================================================

-- Ensure RLS is enabled (no-op if already enabled)
ALTER TABLE dm_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- dm_rooms: participants can update their own DM room
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "dm_rooms_participants_update" ON dm_rooms;

CREATE POLICY "dm_rooms_participants_update"
  ON dm_rooms
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = participant_1_id
    OR auth.uid() = participant_2_id
  )
  WITH CHECK (
    auth.uid() = participant_1_id
    OR auth.uid() = participant_2_id
  );

-- ---------------------------------------------------------------------
-- clubs: members can update their club row
-- (Tighten to admin/owner role if you want to restrict who can change theme)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "clubs_members_update" ON clubs;

CREATE POLICY "clubs_members_update"
  ON clubs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM club_members cm
      WHERE cm.club_id = clubs.id
        AND cm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM club_members cm
      WHERE cm.club_id = clubs.id
        AND cm.user_id = auth.uid()
    )
  );
