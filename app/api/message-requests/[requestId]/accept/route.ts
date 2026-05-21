import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/message-requests/[requestId]/accept - Accept a message request
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
    // Update the message request status to accepted
    const { data, error } = await supabase
      .from('message_requests')
      .update({ status: 'accepted' })
      .eq('id', requestId)
      .eq('user_id', user.id) // Ensure user owns this request
      .select('room_id')
      .single()

    if (error) {
      console.error('Error accepting message request:', error)
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
      message: 'Message request accepted',
    })
  } catch (error) {
    console.error('Error accepting message request:', error)
    return NextResponse.json(
      { error: 'Failed to accept message request' },
      { status: 500 }
    )
  }
}
