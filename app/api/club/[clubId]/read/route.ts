import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Mark messages in this club as read up to the given messageId.
 * Body: { messageId: string }
 */
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

  const { data: membership } = await supabase
    .from('club_members')
    .select('id')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { messageId } = body as { messageId?: string }
  if (!messageId) {
    return NextResponse.json({ error: 'messageId is required' }, { status: 400 })
  }

  const { data: target } = await supabase
    .from('club_messages')
    .select('id, created_at')
    .eq('id', messageId)
    .eq('club_id', clubId)
    .single()

  if (!target) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  const { data: messages } = await supabase
    .from('club_messages')
    .select('id')
    .eq('club_id', clubId)
    .neq('user_id', user.id)
    .lte('created_at', target.created_at)
    .is('deleted_at', null)

  if (!messages || messages.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0 })
  }

  const rows = messages.map((m: { id: string }) => ({
    room_type: 'club',
    room_id: clubId,
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
