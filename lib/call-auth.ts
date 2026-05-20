// Generic Supabase client type - works with @supabase/ssr and @supabase/supabase-js
// Using any to match the flexible Supabase query builder chain
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientLike = any

import { checkDMRoomBlockStatus, checkClubRoomBlockStatus } from './blocks'

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

export interface CallBlockCheck {
  canCall: boolean
  error?: string
  code?: string
}

export async function checkCanStartCall(
  supabase: SupabaseClientLike,
  userId: string,
  roomType: 'dm' | 'club',
  roomId: string
): Promise<CallBlockCheck> {
  // First check if user can access the room
  const canAccess = await canAccessChatRoom(supabase, userId, roomType, roomId)
  if (!canAccess) {
    return { canCall: false, error: 'You do not have access to this room', code: 'NO_ACCESS' }
  }

  // Then check block status
  if (roomType === 'dm') {
    const blockStatus = await checkDMRoomBlockStatus(supabase, userId, roomId)
    if (!blockStatus.canInteract) {
      if (blockStatus.hasBlocked) {
        return {
          canCall: false,
          error: 'You have blocked this user. Unblock them to make calls.',
          code: 'BLOCKED_BY_YOU'
        }
      } else {
        return {
          canCall: false,
          error: 'This user has blocked you. You cannot make calls to them.',
          code: 'BLOCKED_BY_OTHER'
        }
      }
    }
  } else {
    const blockStatus = await checkClubRoomBlockStatus(supabase, userId, roomId)
    if (!blockStatus.canSend) {
      return {
        canCall: false,
        error: 'You cannot make calls because you have blocked some members or been blocked.',
        code: 'BLOCKED'
      }
    }
  }

  return { canCall: true }
}
