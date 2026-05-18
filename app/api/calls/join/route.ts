import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessChatRoom, getUserDisplayName } from '@/lib/call-auth'
import { createLiveKitToken, getPublicLiveKitUrl } from '@/lib/livekit'

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

    const { data: session, error: fetchError } = await supabase
      .from('call_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    if (!['ringing', 'active'].includes(session.status)) {
      return NextResponse.json({ error: 'Call is no longer available' }, { status: 410 })
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

    const displayName = await getUserDisplayName(supabase, user.id)
    const token = await createLiveKitToken({
      identity: user.id,
      name: displayName,
      roomName: session.livekit_room,
      callType: session.call_type,
    })

    const updates: Record<string, string> = {
      status: 'active',
      updated_at: new Date().toISOString(),
    }
    if (!session.started_at) {
      updates.started_at = new Date().toISOString()
    }

    const { data: updated, error: updateError } = await supabase
      .from('call_sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      session: updated,
      token,
      serverUrl: getPublicLiveKitUrl(),
    })
  } catch (err) {
    console.error('Call join error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to join call' },
      { status: 500 }
    )
  }
}
