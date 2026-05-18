import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessChatRoom, getUserDisplayName } from '@/lib/call-auth'
import {
  createLiveKitToken,
  getLiveKitRoomName,
  getPublicLiveKitUrl,
} from '@/lib/livekit'

export async function POST(request: NextRequest) {
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
    const { roomType, roomId, callType } = body as {
      roomType: 'dm' | 'club'
      roomId: string
      callType: 'audio' | 'video'
    }

    if (!roomType || !roomId || !callType) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const hasAccess = await canAccessChatRoom(supabase, user.id, roomType, roomId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // End any stale ringing/active sessions for this room
    await supabase
      .from('call_sessions')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('room_type', roomType)
      .eq('room_id', roomId)
      .in('status', ['ringing', 'active'])

    const livekitRoom = getLiveKitRoomName(roomType, roomId)
    const displayName = await getUserDisplayName(supabase, user.id)

    const { data: session, error: insertError } = await supabase
      .from('call_sessions')
      .insert({
        room_type: roomType,
        room_id: roomId,
        call_type: callType,
        status: 'ringing',
        caller_id: user.id,
        livekit_room: livekitRoom,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    const token = await createLiveKitToken({
      identity: user.id,
      name: displayName,
      roomName: livekitRoom,
      callType,
    })

    return NextResponse.json({
      session,
      token,
      serverUrl: getPublicLiveKitUrl(),
    })
  } catch (err) {
    console.error('Call start error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start call' },
      { status: 500 }
    )
  }
}
