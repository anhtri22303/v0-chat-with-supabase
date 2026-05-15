import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('dm_rooms')
    .select(
      `
      id,
      participant_1_id,
      participant_2_id,
      created_at,
      updated_at,
      dm_messages(id, content, user_id, created_at, order: created_at.desc, limit: 1),
      participant1:participant_1_id(id, username, avatar_url),
      participant2:participant_2_id(id, username, avatar_url)
    `
    )
    .or(`participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}`)
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    rooms: data || [],
    timestamp: new Date().toISOString(),
  })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { participantId } = body

  if (!participantId) {
    return NextResponse.json(
      { error: 'participantId is required' },
      { status: 400 }
    )
  }

  if (participantId === user.id) {
    return NextResponse.json(
      { error: 'Cannot create DM with yourself' },
      { status: 400 }
    )
  }

  // Check if participant exists
  const { data: participant } = await supabase
    .from('users')
    .select('id')
    .eq('id', participantId)
    .single()

  if (!participant) {
    return NextResponse.json(
      { error: 'Participant not found' },
      { status: 404 }
    )
  }

  // Determine room key (smaller id first)
  const p1 = user.id < participantId ? user.id : participantId
  const p2 = user.id < participantId ? participantId : user.id

  // Try to find existing room
  const { data: existingRoom } = await supabase
    .from('dm_rooms')
    .select('id')
    .eq('participant_1_id', p1)
    .eq('participant_2_id', p2)
    .single()

  if (existingRoom) {
    return NextResponse.json({ room: existingRoom })
  }

  // Create new room
  const { data, error } = await supabase
    .from('dm_rooms')
    .insert({
      participant_1_id: p1,
      participant_2_id: p2,
    })
    .select(
      `
      id,
      participant_1_id,
      participant_2_id,
      created_at,
      participant1:participant_1_id(id, username, avatar_url),
      participant2:participant_2_id(id, username, avatar_url)
    `
    )
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ room: data }, { status: 201 })
}
