-- Add last_seen column to users table for online presence tracking

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

-- Allow authenticated users to update their own last_seen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users' AND policyname = 'users_update_own_last_seen'
  ) THEN
    CREATE POLICY users_update_own_last_seen ON users
      FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;
