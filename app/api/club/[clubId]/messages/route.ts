import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { attachReads, fetchReadsByMessageIds } from '@/lib/message-reads'
import { checkClubRoomBlockStatus } from '@/lib/blocks'

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
  const search = searchParams.get('search')?.trim()
  const limit = search
    ? Math.min(parseInt(searchParams.get('limit') || '30'), 30)
    : parseInt(searchParams.get('limit') || '50')
  const before = searchParams.get('before')

  let query = supabase
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

  const ordered = data?.reverse() || []
  const readsMap = await fetchReadsByMessageIds(
    supabase,
    'club',
    ordered.map((m: any) => m.id),
    user.id
  )

  return NextResponse.json({
    messages: attachReads(ordered, readsMap),
    timestamp: new Date().toISOString(),
  })
}

export async function POST(
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

  // Check block status with club members
  const blockStatus = await checkClubRoomBlockStatus(supabase, user.id, clubId)
  if (!blockStatus.canSend) {
    return NextResponse.json({ 
      error: 'You cannot send messages because you have blocked some members or been blocked.',
      code: 'BLOCKED'
    }, { status: 403 })
  }

  const body = await request.json()
  const { content, replyToMessageId, mediaUrl, mediaType, clientMessageId } = body

  if ((!content || typeof content !== 'string' || content.trim().length === 0) && !mediaUrl) {
    return NextResponse.json(
      { error: 'Content or media is required' },
      { status: 400 }
    )
  }

  // Idempotency check: if clientMessageId exists, return existing message
  if (clientMessageId) {
    const { data: existingMessage } = await supabase
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
      .eq('client_message_id', clientMessageId)
      .single()

    if (existingMessage) {
      console.log(`[Idempotency] Returning existing message for clientMessageId: ${clientMessageId}`)
      return NextResponse.json(existingMessage, { status: 200 })
    }
  }

  const insertData: Record<string, string> = {
    club_id: clubId,
    user_id: user.id,
    content: (content || '').trim(),
  }
  if (mediaUrl) insertData.media_url = mediaUrl
  if (mediaType) insertData.media_type = mediaType
  if (clientMessageId) insertData.client_message_id = clientMessageId

  const { data, error } = await supabase
    .from('club_messages')
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
      club_message_reactions(emoji, user_id),
      club_message_replies(id, reply_to_message_id)
    `
    )
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If this is a reply, create a reply record linking new message to parent
  if (replyToMessageId && data) {
    await supabase
      .from('club_message_replies')
      .insert({
        message_id: data.id,
        reply_to_message_id: replyToMessageId,
        user_id: user.id,
        content: (content || '').trim(),
      })

    // Re-fetch to include the reply record
    const { data: refreshed } = await supabase
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
      .eq('id', data.id)
      .single()

    if (refreshed) {
      return NextResponse.json(refreshed, { status: 201 })
    }
  }

  return NextResponse.json(data, { status: 201 })
}
