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

    // Only non-caller can decline a ringing call
    if (session.status === 'ringing' && session.caller_id !== user.id) {
      const { data: updated, error } = await supabase
        .from('call_sessions')
        .update({
          status: 'declined',
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ session: updated })
    }

    return NextResponse.json({ error: 'Cannot decline this call' }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to decline' },
      { status: 500 }
    )
  }
}
