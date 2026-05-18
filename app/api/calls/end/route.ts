import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessChatRoom } from '@/lib/call-auth'
import { deleteLiveKitRoom } from '@/lib/livekit'

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
    const { sessionId } = body as { sessionId: string }

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }

    const { data: session } = await supabase
      .from('call_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    const hasAccess = await canAccessChatRoom(
      supabase,
      user.id,
      session.room_type,
      session.room_id
    )
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: updated, error } = await supabase
      .from('call_sessions')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // For DM, delete LiveKit room when call ends. For club, only delete if no active participants logic - simplify: always delete on explicit end by last person - for phase 1 delete room on any end from caller or participant
    if (session.room_type === 'dm') {
      await deleteLiveKitRoom(session.livekit_room)
    } else {
      // Club: delete room when session ends (all leave triggers end from client)
      await deleteLiveKitRoom(session.livekit_room)
    }

    return NextResponse.json({ session: updated })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to end call' },
      { status: 500 }
    )
  }
}
