import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessChatRoom } from '@/lib/call-auth'

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
    const { sessionId, callType } = body as {
      sessionId: string
      callType: 'audio' | 'video'
    }

    if (!sessionId || !callType) {
      return NextResponse.json({ error: 'sessionId and callType required' }, { status: 400 })
    }

    if (!['audio', 'video'].includes(callType)) {
      return NextResponse.json({ error: 'Invalid callType' }, { status: 400 })
    }

    const { data: session } = await supabase
      .from('call_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    if (session.status !== 'active') {
      return NextResponse.json({ error: 'Call is not active' }, { status: 400 })
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
        call_type: callType,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ session: updated })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to switch call type' },
      { status: 500 }
    )
  }
}
