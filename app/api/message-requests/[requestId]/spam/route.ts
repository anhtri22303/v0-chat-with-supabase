import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/message-requests/[requestId]/spam - Mark a message request as spam
export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Update the message request status to spam
    const { data, error } = await supabase
      .from('message_requests')
      .update({ status: 'spam' })
      .eq('id', requestId)
      .eq('user_id', user.id) // Ensure user owns this request
      .select('room_id')
      .single()

    if (error) {
      console.error('Error marking message request as spam:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Message request not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      room_id: data.room_id,
      message: 'Message request marked as spam',
    })
  } catch (error) {
    console.error('Error marking message request as spam:', error)
    return NextResponse.json(
      { error: 'Failed to mark message request as spam' },
      { status: 500 }
    )
  }
}
