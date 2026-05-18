import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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
  const { messageId, emoji } = body

  if (!messageId || !emoji) {
    return NextResponse.json(
      { error: 'messageId and emoji are required' },
      { status: 400 }
    )
  }

  // Check if message exists and belongs to this room
  const { data: message } = await supabase
    .from('dm_messages')
    .select('id')
    .eq('id', messageId)
    .eq('room_id', roomId)
    .single()

  if (!message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  // Check if reaction already exists
  const { data: existingReaction } = await supabase
    .from('dm_message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', user.id)
    .eq('emoji', emoji)
    .single()

  if (existingReaction) {
    // Delete reaction if it exists (toggle)
    const { error: deleteError } = await supabase
      .from('dm_message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ action: 'removed' })
  } else {
    // Add reaction
    const { error: insertError } = await supabase
      .from('dm_message_reactions')
      .insert({
        message_id: messageId,
        user_id: user.id,
        emoji,
      })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ action: 'added' }, { status: 201 })
  }
}
