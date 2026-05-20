export interface MessageReadEntry {
  user_id: string
  read_at: string
  users: { username: string; avatar_url: string | null } | null
}

/**
 * Fetch read receipts for the given list of message IDs and group them by
 * message_id. Returns a map: { [messageId]: MessageReadEntry[] }.
 *
 * Excludes the current user's own reads (they're implicitly read).
 */
export async function fetchReadsByMessageIds(
  supabase: any,
  roomType: 'dm' | 'club',
  messageIds: string[],
  excludeUserId?: string
): Promise<Record<string, MessageReadEntry[]>> {
  const map: Record<string, MessageReadEntry[]> = {}
  if (!messageIds || messageIds.length === 0) return map

  let query = supabase
    .from('message_reads')
    .select('message_id, user_id, read_at, users:user_id(username, avatar_url)')
    .eq('room_type', roomType)
    .in('message_id', messageIds)

  if (excludeUserId) {
    query = query.neq('user_id', excludeUserId)
  }

  const { data, error } = await query
  if (error || !data) return map

  for (const row of data as any[]) {
    const arr = (map[row.message_id] ||= [])
    arr.push({
      user_id: row.user_id,
      read_at: row.read_at,
      users: row.users || null,
    })
  }
  return map
}

/**
 * Attach a `reads` array to each message in the list using the map from
 * fetchReadsByMessageIds.
 */
export function attachReads<T extends { id: string }>(
  messages: T[],
  readsMap: Record<string, MessageReadEntry[]>
): (T & { reads: MessageReadEntry[] })[] {
  return messages.map((m) => ({ ...m, reads: readsMap[m.id] || [] }))
}
