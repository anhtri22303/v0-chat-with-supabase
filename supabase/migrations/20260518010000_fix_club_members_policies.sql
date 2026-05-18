-- Fix recursive club_members policies and reuse membership checks safely

CREATE OR REPLACE FUNCTION public.is_club_member(club_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = $1
      AND cm.user_id = $2
  );
$$;

CREATE OR REPLACE FUNCTION public.is_club_leader(club_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = $1
      AND cm.user_id = $2
      AND cm.role = 'leader'
  );
$$;

CREATE OR REPLACE FUNCTION public.club_has_members(club_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_members cm
    WHERE cm.club_id = $1
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_club_member(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_club_leader(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.club_has_members(UUID) TO authenticated, anon;

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'club_members'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.club_members', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY club_members_select ON public.club_members
  FOR SELECT
  USING (
    public.is_club_member(club_id, auth.uid())
  );

CREATE POLICY club_members_insert ON public.club_members
  FOR INSERT
  WITH CHECK (
    (user_id = auth.uid() AND role = 'leader' AND NOT public.club_has_members(club_id))
    OR public.is_club_leader(club_id, auth.uid())
  );

CREATE POLICY club_members_update ON public.club_members
  FOR UPDATE
  USING (
    public.is_club_leader(club_id, auth.uid()) OR user_id = auth.uid()
  )
  WITH CHECK (
    public.is_club_leader(club_id, auth.uid()) OR user_id = auth.uid()
  );

CREATE POLICY club_members_delete ON public.club_members
  FOR DELETE
  USING (
    public.is_club_leader(club_id, auth.uid()) OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS call_sessions_club_select ON public.call_sessions;
DROP POLICY IF EXISTS call_sessions_club_insert ON public.call_sessions;
DROP POLICY IF EXISTS call_sessions_club_update ON public.call_sessions;

CREATE POLICY call_sessions_club_select ON public.call_sessions
  FOR SELECT
  USING (
    room_type = 'club'
    AND public.is_club_member(room_id, auth.uid())
  );

CREATE POLICY call_sessions_club_insert ON public.call_sessions
  FOR INSERT
  WITH CHECK (
    room_type = 'club'
    AND caller_id = auth.uid()
    AND public.is_club_member(room_id, auth.uid())
  );

CREATE POLICY call_sessions_club_update ON public.call_sessions
  FOR UPDATE
  USING (
    room_type = 'club'
    AND public.is_club_member(room_id, auth.uid())
  );
