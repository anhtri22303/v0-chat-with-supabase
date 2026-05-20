import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/mutes - Get all muted rooms for current user
export async function GET() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: mutes, error } = await supabase
    .from('notification_mutes')
    .select('*')
    .eq('user_id', user.id)
    .or('muted_until.is.null,muted_until.gt.now()')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching mutes:', error)
    return NextResponse.json({ error: 'Failed to fetch mutes' }, { status: 500 })
  }

  return NextResponse.json({ mutes: mutes || [] })
}

// POST /api/mutes - Mute a room
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { room_id, room_type, duration } = await request.json()
    
    if (!room_id || !room_type) {
      return NextResponse.json({ error: 'room_id and room_type are required' }, { status: 400 })
    }

    if (!['dm', 'club'].includes(room_type)) {
      return NextResponse.json({ error: 'room_type must be dm or club' }, { status: 400 })
    }

    // Calculate muted_until based on duration
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

    // Upsert mute
    const { data: mute, error } = await supabase
      .from('notification_mutes')
      .upsert({
        user_id: user.id,
        room_id,
        room_type,
        muted_until,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,room_id,room_type',
      })
      .select()
      .single()

    if (error) {
      console.error('Error muting room:', error)
      return NextResponse.json({ error: 'Failed to mute room' }, { status: 500 })
    }

    return NextResponse.json({ mute }, { status: 201 })
  } catch (err) {
    console.error('Error in mute POST:', err)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
