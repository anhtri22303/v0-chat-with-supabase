import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// DELETE /api/message-requests/[requestId] - Delete a message request
export async function DELETE(
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
    // Update the message request status to deleted (soft delete)
    const { data, error } = await supabase
      .from('message_requests')
      .update({ status: 'deleted' })
      .eq('id', requestId)
      .eq('user_id', user.id) // Ensure user owns this request
      .select('room_id')
      .single()

    if (error) {
      console.error('Error deleting message request:', error)
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
      message: 'Message request deleted',
    })
  } catch (error) {
    console.error('Error deleting message request:', error)
    return NextResponse.json(
      { error: 'Failed to delete message request' },
      { status: 500 }
    )
  }
}

// PATCH /api/message-requests/[requestId] - Update message request status
export async function PATCH(
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
    const body = await request.json()
    const { status } = body

    if (!status || !['new', 'accepted', 'spam', 'deleted'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('message_requests')
      .update({ status })
      .eq('id', requestId)
      .eq('user_id', user.id)
      .select('room_id')
      .single()

    if (error) {
      console.error('Error updating message request:', error)
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
      status,
      message: 'Message request updated',
    })
  } catch (error) {
    console.error('Error updating message request:', error)
    return NextResponse.json(
      { error: 'Failed to update message request' },
      { status: 500 }
    )
  }
}
