import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Mark messages in this DM room as read up to the given messageId.
 * Body: { messageId: string }
 *
 * Inserts a row into message_reads for every message in the room
 * created at or before the target message (and not already marked).
 * Excludes the user's own messages.
 */
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

  // Verify membership
  const { data: room } = await supabase
    .from('dm_rooms')
    .select('id')
    .eq('id', roomId)
    .or(`participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}`)
    .single()

  if (!room) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { messageId } = body as { messageId?: string }
  if (!messageId) {
    return NextResponse.json({ error: 'messageId is required' }, { status: 400 })
  }

  // Look up target message timestamp
  const { data: target } = await supabase
    .from('dm_messages')
    .select('id, created_at')
    .eq('id', messageId)
    .eq('room_id', roomId)
    .single()

  if (!target) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  // Get all messages in this room up to target.created_at, excluding own.
  const { data: messages } = await supabase
    .from('dm_messages')
    .select('id')
    .eq('room_id', roomId)
    .neq('user_id', user.id)
    .lte('created_at', target.created_at)
    .is('deleted_at', null)

  if (!messages || messages.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0 })
  }

  const rows = messages.map((m: { id: string }) => ({
    room_type: 'dm',
    room_id: roomId,
    message_id: m.id,
    user_id: user.id,
  }))

  const { error } = await supabase
    .from('message_reads')
    .upsert(rows, { onConflict: 'user_id,message_id', ignoreDuplicates: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, inserted: rows.length })
}
