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

    // Get other participant info + last message from OTHER user for each DM room
    const dmRoomsWithPartner = await Promise.all(
      dmRoomsSafe.map(async (room: any) => {
        const otherUserId =
          room.participant_1_id === user.id
            ? room.participant_2_id
            : room.participant_1_id

        const { data: otherUser, error: otherUserError } = await supabase
          .from('users')
          .select('id, username, avatar_url')
          .eq('id', otherUserId)
          .single()

        if (otherUserError && otherUserError.code !== 'PGRST116') {
          console.error('Error fetching DM participant:', otherUserError)
        }

        // Fetch last message from anyone, excluding deleted
        const { data: lastMessages } = await supabase
          .from('dm_messages')
          .select('id, content, media_url, media_type, created_at, user_id, users:user_id(id, username)')
          .eq('room_id', room.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)

        const lastMessage = lastMessages?.[0]
        const isOwnMessage = lastMessage?.user_id === user.id

        // Helper to format preview text
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
    )

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

    const clubsWithLastMessage = await Promise.all(
      clubsSafe.map(async (club: any) => {
        // Fetch last message from anyone, excluding deleted
        const { data: lastMessages } = await supabase
          .from('club_messages')
          .select('id, content, media_url, media_type, created_at, user_id, users:user_id(id, username)')
          .eq('club_id', club.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)

        const lastMessage = lastMessages?.[0]
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
    )

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
