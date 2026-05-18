import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessChatRoom } from '@/lib/call-auth'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const roomType = searchParams.get('roomType') as 'dm' | 'club' | null
  const roomId = searchParams.get('roomId')

  if (!roomType || !roomId) {
    return NextResponse.json({ error: 'roomType and roomId required' }, { status: 400 })
  }

  const hasAccess = await canAccessChatRoom(supabase, user.id, roomType, roomId)
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: session } = await supabase
    .from('call_sessions')
    .select('*')
    .eq('room_type', roomType)
    .eq('room_id', roomId)
    .in('status', ['ringing', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ session: session || null })
}
