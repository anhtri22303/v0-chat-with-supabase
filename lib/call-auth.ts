// Generic Supabase client type - works with @supabase/ssr and @supabase/supabase-js
// Using any to match the flexible Supabase query builder chain
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientLike = any

export async function canAccessChatRoom(
  supabase: SupabaseClientLike,
  userId: string,
  roomType: 'dm' | 'club',
  roomId: string
): Promise<boolean> {
  if (roomType === 'dm') {
    const { data } = await supabase
      .from('dm_rooms')
      .select('id')
      .eq('id', roomId)
      .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
      .single()
    return !!data
  }

  const { data } = await supabase
    .from('club_members')
    .select('id')
    .eq('club_id', roomId)
    .eq('user_id', userId)
    .single()

  return !!data
}

export async function getUserDisplayName(
  supabase: SupabaseClientLike,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from('users')
    .select('username')
    .eq('id', userId)
    .single()

  return data?.username || 'User'
}
