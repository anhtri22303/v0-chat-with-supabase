import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Fetch DM rooms
    const { data: dmRooms, error: dmError } = await supabase
      .from('dm_rooms')
      .select(
        `
        id,
        participant_1_id,
        participant_2_id,
        created_at,
        updated_at,
        dm_messages (
          id,
          content,
          created_at,
          users:user_id (id, username, avatar_url)
        )
      `
      )
      .or(
        `participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}`
      )
      .order('updated_at', { ascending: false })
      .order('created_at', { referencedTable: 'dm_messages', ascending: false })
      .limit(1, { referencedTable: 'dm_messages' })

    if (dmError) throw dmError

    const dmRoomsSafe = dmRooms ?? []

    // Get other participant info for each DM room
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

        const lastMessage = room.dm_messages?.[0]

        return {
          type: 'dm' as const,
          id: room.id,
          name: otherUser?.username || 'Unknown',
          avatar_url: otherUser?.avatar_url,
          last_message: lastMessage?.content || 'No messages yet',
          last_message_time: lastMessage?.created_at || room.created_at,
          last_message_sender_id: lastMessage?.users?.id,
          last_message_sender_name: lastMessage?.users?.username,
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
        ),
        club_messages (
          id,
          content,
          created_at,
          users:user_id (id, username)
        )
      `
      )
      .eq('club_members.user_id', user.id)
      .order('created_at', { ascending: false })
      .order('created_at', { referencedTable: 'club_messages', ascending: false })
      .limit(1, { referencedTable: 'club_messages' })

    if (clubError) {
      console.error('Error fetching clubs:', clubError)
    }

    const clubsSafe = clubError ? [] : clubs ?? []

    const clubsWithLastMessage = clubsSafe.map((club: any) => {
      const lastMessage = club.club_messages?.[0]

      return {
        type: 'group' as const,
        id: club.id,
        name: club.name,
        description: club.description,
        last_message: lastMessage?.content || 'No messages yet',
        last_message_time: lastMessage?.created_at || club.created_at,
        last_message_sender_id: lastMessage?.users?.id,
        last_message_sender_name: lastMessage?.users?.username,
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
