import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/message-requests - Get message requests for current user
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'new' // 'new' or 'spam'

  try {
    // Fetch message requests (without relationship query)
    const { data: requests, error } = await supabase
      .from('message_requests')
      .select(`
        id,
        room_id,
        sender_id,
        status,
        first_message_at,
        updated_at
      `)
      .eq('user_id', user.id)
      .eq('status', status)
      .order('first_message_at', { ascending: false })

    if (error) {
      console.error('Error fetching message requests:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get unique sender IDs to fetch their info
    const senderIds = [...new Set((requests || []).map((r: any) => r.sender_id))]
    
    // Fetch sender info separately
    const { data: senders } = await supabase
      .from('users')
      .select('id, username, avatar_url')
      .in('id', senderIds)
    
    const senderMap = new Map(senders?.map((s: any) => [s.id, s]) || [])

    // Fetch last message for each room
    const requestsWithLastMessage = await Promise.all(
      (requests || []).map(async (req: any) => {
        const { data: lastMessages } = await supabase
          .from('dm_messages')
          .select('id, content, media_url, media_type, created_at, user_id')
          .eq('room_id', req.room_id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)

        const lastMessage = lastMessages?.[0]

        // Format preview text
        let previewText = ''
        if (lastMessage) {
          if (lastMessage.media_type === 'image') {
            previewText = lastMessage.content ? `[Ảnh] ${lastMessage.content}` : 'Đã gửi một ảnh'
          } else if (lastMessage.media_type === 'video') {
            previewText = lastMessage.content ? `[Video] ${lastMessage.content}` : 'Đã gửi một video'
          } else {
            previewText = lastMessage.content || ''
          }
        }

        const sender = senderMap.get(req.sender_id)

        return {
          id: req.id,
          room_id: req.room_id,
          sender_id: req.sender_id,
          sender: sender || { id: req.sender_id, username: 'Unknown', avatar_url: null },
          status: req.status,
          first_message_at: req.first_message_at,
          last_message: previewText,
          last_message_time: lastMessage?.created_at || req.first_message_at,
        }
      })
    )

    return NextResponse.json({
      requests: requestsWithLastMessage,
      status: status,
    })
  } catch (error) {
    console.error('Error in message requests API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch message requests' },
      { status: 500 }
    )
  }
}
