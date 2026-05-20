import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { attachReads, fetchReadsByMessageIds } from '@/lib/message-reads'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is member of club
  const { data: membership } = await supabase
    .from('club_members')
    .select('id')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const after = searchParams.get('after')

  if (!after) {
    return NextResponse.json({ error: 'Missing after parameter' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('club_messages')
    .select(
      `
      id,
      content,
      media_url,
      media_type,
      user_id,
      created_at,
      users:user_id(username, avatar_url),
      club_message_reactions(emoji, user_id),
      club_message_replies(id, reply_to_message_id)
    `
    )
    .eq('club_id', clubId)
    .is('deleted_at', null)
    .gt('created_at', after)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Also get messages deleted since last poll
  const { data: deletedMessages } = await supabase
    .from('club_messages')
    .select('id')
    .eq('club_id', clubId)
    .not('deleted_at', 'is', null)
    .gt('deleted_at', after)

  // Also get typing indicators
  const { data: typingData } = await supabase
    .from('club_typing_indicators')
    .select('user_id, updated_at, users:user_id(username)')
    .eq('club_id', clubId)
    .gt('updated_at', new Date(Date.now() - 5000).toISOString())

  const messages = data || []
  const readsMap = await fetchReadsByMessageIds(
    supabase,
    'club',
    messages.map((m: any) => m.id),
    user.id
  )

  const { data: recentReads } = await supabase
    .from('message_reads')
    .select('message_id, user_id, read_at, users:user_id(username, avatar_url)')
    .eq('room_type', 'club')
    .eq('room_id', clubId)
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
