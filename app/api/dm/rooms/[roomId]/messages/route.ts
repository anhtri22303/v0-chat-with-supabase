import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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
  const search = searchParams.get('search')?.trim()
  const limit = search
    ? Math.min(parseInt(searchParams.get('limit') || '30'), 30)
    : parseInt(searchParams.get('limit') || '50')
  const before = searchParams.get('before')

  let query = supabase
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
    .order('created_at', { ascending: false })
    .limit(limit)

  if (search) {
    query = query.ilike('content', `%${search.replace(/[%_\\]/g, '\\$&')}%`)
  }

  if (before) {
    query = query.lt('created_at', before)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    messages: data?.reverse() || [],
    timestamp: new Date().toISOString(),
  })
}

export async function POST(
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

  const body = await request.json()
  const { content, replyToMessageId, mediaUrl, mediaType } = body

  if ((!content || typeof content !== 'string' || content.trim().length === 0) && !mediaUrl) {
    return NextResponse.json(
      { error: 'Content or media is required' },
      { status: 400 }
    )
  }

  const insertData: Record<string, string> = {
    room_id: roomId,
    user_id: user.id,
    content: (content || '').trim(),
  }
  if (mediaUrl) insertData.media_url = mediaUrl
  if (mediaType) insertData.media_type = mediaType

  const { data, error } = await supabase
    .from('dm_messages')
    .insert(insertData)
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
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If this is a reply, create a reply record linking new message to parent
  if (replyToMessageId && data) {
    await supabase
      .from('dm_message_replies')
      .insert({
        message_id: data.id,
        reply_to_message_id: replyToMessageId,
        user_id: user.id,
        content: (content || '').trim(),
      })
  }

  // Update room's updated_at timestamp
  await supabase
    .from('dm_rooms')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', roomId)

  // Re-fetch to include the reply record we just inserted
  if (replyToMessageId && data) {
    const { data: refreshed } = await supabase
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
      .eq('id', data.id)
      .single()

    if (refreshed) {
      return NextResponse.json(refreshed, { status: 201 })
    }
  }

  return NextResponse.json(data, { status: 201 })
}
