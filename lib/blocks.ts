import { createClient } from '@/lib/supabase/client'

type SupabaseClient = ReturnType<typeof createClient>

export interface BlockCheckResult {
  hasBlocked: boolean
  isBlockedBy: boolean
  canInteract: boolean
  blockStatus: 'none' | 'blocked' | 'blocked_by'
}

export async function checkBlockStatus(
  supabase: SupabaseClient,
  userId: string,
  targetUserId: string
): Promise<BlockCheckResult> {
  // Check if current user has blocked target user
  const { data: hasBlocked } = await supabase
    .from('user_blocks')
    .select('id')
    .eq('blocker_id', userId)
    .eq('blocked_id', targetUserId)
    .single()

  // Check if target user has blocked current user
  const { data: isBlockedBy } = await supabase
    .from('user_blocks')
    .select('id')
    .eq('blocker_id', targetUserId)
    .eq('blocked_id', userId)
    .single()

  const hasBlockedBool = !!hasBlocked
  const isBlockedByBool = !!isBlockedBy

  let blockStatus: 'none' | 'blocked' | 'blocked_by' = 'none'
  if (hasBlockedBool) blockStatus = 'blocked'
  else if (isBlockedByBool) blockStatus = 'blocked_by'

  return {
    hasBlocked: hasBlockedBool,
    isBlockedBy: isBlockedByBool,
    canInteract: !hasBlockedBool && !isBlockedByBool,
    blockStatus,
  }
}

export async function isUserBlocked(
  supabase: SupabaseClient,
  userId1: string,
  userId2: string
): Promise<boolean> {
  const { data } = await supabase
    .from('user_blocks')
    .select('id')
    .or(`and(blocker_id.eq.${userId1},blocked_id.eq.${userId2}),and(blocker_id.eq.${userId2},blocked_id.eq.${userId1})`)
    .single()

  return !!data
}

// Check block status for a DM room
export async function checkDMRoomBlockStatus(
  supabase: SupabaseClient,
  userId: string,
  roomId: string
): Promise<BlockCheckResult> {
  // Get the other participant in the room
  const { data: room } = await supabase
    .from('dm_rooms')
    .select('participant_1_id, participant_2_id')
    .eq('id', roomId)
    .single()

  if (!room) {
    return {
      hasBlocked: false,
      isBlockedBy: false,
      canInteract: false,
      blockStatus: 'none',
    }
  }

  const otherUserId = room.participant_1_id === userId 
    ? room.participant_2_id 
    : room.participant_1_id

  return checkBlockStatus(supabase, userId, otherUserId)
}

// Check block status for a club room (check against all members)
export async function checkClubRoomBlockStatus(
  supabase: SupabaseClient,
  userId: string,
  clubId: string
): Promise<{ canSend: boolean; blockedUsers: string[] }> {
  // Get all members except current user
  const { data: members } = await supabase
    .from('club_members')
    .select('user_id')
    .eq('club_id', clubId)
    .neq('user_id', userId)

  if (!members || members.length === 0) {
    return { canSend: true, blockedUsers: [] }
  }

  const blockedUsers: string[] = []

  for (const member of members) {
    const status = await checkBlockStatus(supabase, userId, member.user_id)
    if (!status.canInteract) {
      blockedUsers.push(member.user_id)
    }
  }

  return {
    canSend: blockedUsers.length === 0,
    blockedUsers,
  }
}
