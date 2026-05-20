import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { attachReads, fetchReadsByMessageIds } from '@/lib/message-reads'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is participant in room
  const { data: room } = await supabase
    .from('dm_rooms')
    .select('id')
    .eq('id', roomId)
    .or(`participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}`)
    .single()

  if (!room) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const after = searchParams.get('after')

  if (!after) {
    return NextResponse.json({ error: 'Missing after parameter' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('dm_messages')
    .select(
      `
      id,
      content,
      media_url,
      media_type,
      user_id,
      created_at,
      users:user_id(username, avatar_url),
      dm_message_reactions(emoji, user_id),
      dm_message_replies:dm_message_replies!dm_message_replies_message_id_fkey(
        id,
        reply_to_message_id,
        user_id,
        content,
        created_at
      )
    `
    )
    .eq('room_id', roomId)
    .is('deleted_at', null)
    .gt('created_at', after)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Also get messages deleted since last poll
  const { data: deletedMessages } = await supabase
    .from('dm_messages')
    .select('id')
    .eq('room_id', roomId)
    .not('deleted_at', 'is', null)
    .gt('deleted_at', after)

  // Also get typing indicators
  const { data: typingData } = await supabase
    .from('dm_typing_indicators')
    .select('user_id, updated_at, users:user_id(username)')
    .eq('room_id', roomId)
    .gt('updated_at', new Date(Date.now() - 5000).toISOString())

  const messages = data || []
  const readsMap = await fetchReadsByMessageIds(
    supabase,
    'dm',
    messages.map((m: any) => m.id),
    user.id
  )

  // Also fetch any new reads for messages within the polling window so
  // the client can update receipts on already-loaded messages.
  const { data: recentReads } = await supabase
    .from('message_reads')
    .select('message_id, user_id, read_at, users:user_id(username, avatar_url)')
    .eq('room_type', 'dm')
    .eq('room_id', roomId)
    .neq('user_id', user.id)
    .gt('read_at', after)

  return NextResponse.json({
    messages: attachReads(messages, readsMap),
    reads: recentReads || [],
    deleted_ids: (deletedMessages || []).map((m: any) => m.id),
    typing: typingData || [],
    timestamp: new Date().toISOString(),
  })
}
