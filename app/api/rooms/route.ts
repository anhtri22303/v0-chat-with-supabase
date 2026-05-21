import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getTranslations } from 'next-intl/server'

export async function GET() {
  const supabase = await createClient()
  const t = await getTranslations('notifications')

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Fetch DM rooms (without messages - we'll query them separately)
    const { data: dmRooms, error: dmError } = await supabase
      .from('dm_rooms')
      .select(
        `
        id,
        participant_1_id,
        participant_2_id,
        created_at,
        updated_at
      `
      )
      .or(
        `participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}`
      )
      .order('updated_at', { ascending: false })

    if (dmError) throw dmError

    const dmRoomsSafe = dmRooms ?? []

    // OPTIMIZED: Get all other user IDs and fetch them in one query
    const otherUserIds = dmRoomsSafe.map((room: any) =>
      room.participant_1_id === user.id ? room.participant_2_id : room.participant_1_id
    )
    
    const { data: allOtherUsers } = await supabase
      .from('users')
      .select('id, username, avatar_url')
      .in('id', otherUserIds)
    
    const userMap = new Map(allOtherUsers?.map((u: any) => [u.id, u]) || [])

    // OPTIMIZED: Fetch last messages for all rooms in one query using room_id filter
    const roomIds = dmRoomsSafe.map((r: any) => r.id)
    const { data: allLastMessages } = await supabase
      .from('dm_messages')
      .select('id, room_id, content, media_url, media_type, created_at, user_id, users:user_id(id, username)')
      .in('room_id', roomIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    // Get the latest message for each room
    const lastMessageMap = new Map()
    allLastMessages?.forEach((msg: any) => {
      if (!lastMessageMap.has(msg.room_id)) {
        lastMessageMap.set(msg.room_id, msg)
      }
    })

    // Process DM rooms with cached data
    const dmRoomsWithPartner = dmRoomsSafe.map((room: any) => {
      const otherUserId = room.participant_1_id === user.id ? room.participant_2_id : room.participant_1_id
      const otherUser = userMap.get(otherUserId)
      const lastMessage = lastMessageMap.get(room.id)
      const isOwnMessage = lastMessage?.user_id === user.id

      let previewText = lastMessage
        ? (lastMessage.media_type === 'image'
            ? (lastMessage.content ? t('sentPhotoCaption', { caption: lastMessage.content }) : t('sentPhoto'))
            : lastMessage.media_type === 'video'
              ? (lastMessage.content ? t('sentVideoCaption', { caption: lastMessage.content }) : t('sentVideo'))
              : lastMessage.content || 'No messages yet')
        : 'No messages yet'

      if (isOwnMessage && lastMessage) {
        previewText = `You: ${previewText}`
      }

      const sender = Array.isArray(lastMessage?.users) ? lastMessage?.users?.[0] : lastMessage?.users

      return {
        type: 'dm' as const,
        id: room.id,
        name: otherUser?.username || 'Unknown',
        avatar_url: otherUser?.avatar_url,
        last_message: previewText,
        last_message_time: lastMessage?.created_at || room.created_at,
        last_message_sender_id: sender?.id,
        last_message_sender_name: sender?.username,
        participant: otherUser,
      }
    })

    // Fetch clubs the user is a member of
    const { data: clubs, error: clubError } = await supabase
      .from('clubs')
      .select(
        `
        id,
        name,
        description,
        created_at,
        club_members!inner (
          user_id
        )
      `
      )
      .eq('club_members.user_id', user.id)
      .order('created_at', { ascending: false })

    if (clubError) {
      console.error('Error fetching clubs:', clubError)
    }

    const clubsSafe = clubError ? [] : clubs ?? []

    // OPTIMIZED: Fetch last messages for all clubs in one query
    const clubIds = clubsSafe.map((c: any) => c.id)
    const { data: allClubMessages } = await supabase
      .from('club_messages')
      .select('id, club_id, content, media_url, media_type, created_at, user_id, users:user_id(id, username)')
      .in('club_id', clubIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    // Get the latest message for each club
    const lastClubMessageMap = new Map()
    allClubMessages?.forEach((msg: any) => {
      if (!lastClubMessageMap.has(msg.club_id)) {
        lastClubMessageMap.set(msg.club_id, msg)
      }
    })

    // Process clubs with cached data
    const clubsWithLastMessage = clubsSafe.map((club: any) => {
      const lastMessage = lastClubMessageMap.get(club.id)
      const isOwnMessage = lastMessage?.user_id === user.id

      let previewText = lastMessage
        ? (lastMessage.media_type === 'image'
            ? (lastMessage.content ? t('sentPhotoCaption', { caption: lastMessage.content }) : t('sentPhoto'))
            : lastMessage.media_type === 'video'
              ? (lastMessage.content ? t('sentVideoCaption', { caption: lastMessage.content }) : t('sentVideo'))
              : lastMessage.content || 'No messages yet')
        : 'No messages yet'

      if (isOwnMessage && lastMessage) {
        previewText = `You: ${previewText}`
      }

      const clubSender = Array.isArray(lastMessage?.users) ? lastMessage?.users?.[0] : lastMessage?.users

      return {
        type: 'group' as const,
        id: club.id,
        name: club.name,
        description: club.description,
        last_message: previewText,
        last_message_time: lastMessage?.created_at || club.created_at,
        last_message_sender_id: clubSender?.id,
        last_message_sender_name: clubSender?.username,
        member_count: club.club_members?.length || 0,
      }
    })

    // Combine and sort by last message time
    const allRooms = [...dmRoomsWithPartner, ...clubsWithLastMessage].sort(
      (a, b) =>
        new Date(b.last_message_time).getTime() -
        new Date(a.last_message_time).getTime()
    )

    return NextResponse.json({ rooms: allRooms })
  } catch (error) {
    console.error('Error fetching rooms:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rooms' },
      { status: 500 }
    )
  }
}
