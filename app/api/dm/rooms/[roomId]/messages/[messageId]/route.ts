import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ roomId: string; messageId: string }> }
) {
  const { roomId, messageId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get the message
  const { data: message, error: messageError } = await supabase
    .from('dm_messages')
    .select('id, user_id')
    .eq('id', messageId)
    .eq('room_id', roomId)
    .single()

  if (messageError || !message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  // Check if user owns the message
  if (message.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Soft delete the message
  const { error: deleteError } = await supabase
    .from('dm_messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
