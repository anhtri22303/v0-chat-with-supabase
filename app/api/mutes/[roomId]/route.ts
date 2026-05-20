import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/mutes/[roomId]?type=dm|club - Get mute status for a specific room
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const room_type = searchParams.get('type')

  if (!room_type || !['dm', 'club'].includes(room_type)) {
    return NextResponse.json({ error: 'type query param must be dm or club' }, { status: 400 })
  }

  // Use the helper function
  const { data, error } = await supabase.rpc('get_room_mute_info', {
    p_user_id: user.id,
    p_room_id: roomId,
    p_room_type: room_type,
  })

  if (error) {
    console.error('Error checking mute status:', error)
    return NextResponse.json({ error: 'Failed to check mute status' }, { status: 500 })
  }

  // If no rows returned, room is not muted
  if (!data || data.length === 0) {
    return NextResponse.json({
      is_muted: false,
      muted_until: null,
      time_remaining: null,
    })
  }

  // Map mute_expires_at to muted_until for API response
  const result = data[0]
  return NextResponse.json({
    is_muted: result.is_muted,
    muted_until: result.mute_expires_at,  // map from new column name
    time_remaining: result.time_remaining,
  })
}

// PUT /api/mutes/[roomId] - Update mute duration
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { room_type, duration } = await request.json()
    
    if (!room_type || !['dm', 'club'].includes(room_type)) {
      return NextResponse.json({ error: 'room_type must be dm or club' }, { status: 400 })
    }

    // Calculate new muted_until
    let muted_until: string | null = null
    if (duration && duration !== 'indefinite') {
      const now = new Date()
      switch (duration) {
        case '15m':
          muted_until = new Date(now.getTime() + 15 * 60 * 1000).toISOString()
          break
        case '1h':
          muted_until = new Date(now.getTime() + 60 * 60 * 1000).toISOString()
          break
        case '8h':
          muted_until = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString()
          break
        case '24h':
          muted_until = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
          break
        default:
          return NextResponse.json({ error: 'Invalid duration' }, { status: 400 })
      }
    }

    const { data: mute, error } = await supabase
      .from('notification_mutes')
      .update({
        muted_until,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('room_id', roomId)
      .eq('room_type', room_type)
      .select()
      .single()

    if (error) {
      console.error('Error updating mute:', error)
      return NextResponse.json({ error: 'Failed to update mute' }, { status: 500 })
    }

    return NextResponse.json({ mute })
  } catch (err) {
    console.error('Error in mute PUT:', err)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

// DELETE /api/mutes/[roomId] - Unmute a room
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const room_type = searchParams.get('type')

  if (!room_type || !['dm', 'club'].includes(room_type)) {
    return NextResponse.json({ error: 'type query param must be dm or club' }, { status: 400 })
  }

  const { error } = await supabase
    .from('notification_mutes')
    .delete()
    .eq('user_id', user.id)
    .eq('room_id', roomId)
    .eq('room_type', room_type)

  if (error) {
    console.error('Error unmuting room:', error)
    return NextResponse.json({ error: 'Failed to unmute room' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
