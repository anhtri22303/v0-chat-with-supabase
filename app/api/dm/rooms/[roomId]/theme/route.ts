import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Valid Messenger-style theme colors (expanded)
const VALID_THEME_COLORS = [
  '#0A7CFF', // Messenger Blue (default)
  '#FF0000', // Red
  '#FF8C00', // Orange
  '#FFD700', // Yellow
  '#32CD32', // Green
  '#00CED1', // Cyan
  '#4169E1', // Royal Blue
  '#8A2BE2', // Purple
  '#FF1493', // Deep Pink
  '#FF69B4', // Hot Pink
  '#9370DB', // Medium Purple
  '#20B2AA', // Light Sea Green
  '#DC143C', // Crimson
  '#FF4500', // Orange Red
  '#DAA520', // Gold
  '#228B22', // Forest Green
  '#008B8B', // Dark Cyan
  '#191970', // Midnight Blue
  '#800080', // Purple
  '#C71585', // Medium Violet Red
  '#FF6347', // Tomato
  '#40E0D0', // Turquoise
  '#00FA9A', // Medium Spring Green
  '#F0E68C', // Khaki
  '#DDA0DD', // Plum
  '#BC8F8F', // Rosy Brown
  '#708090', // Slate Gray
  '#2F4F4F', // Dark Slate Gray
]

// Valid background types
const VALID_BACKGROUND_TYPES = ['default', 'color', 'image']

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is a participant in this room
  const { data: room, error: roomError } = await supabase
    .from('dm_rooms')
    .select('participant_1_id, participant_2_id, theme_color, background_type, background_value, background_opacity')
    .eq('id', roomId)
    .single()

  if (roomError || !room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }

  if (room.participant_1_id !== user.id && room.participant_2_id !== user.id) {
    return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
  }

  console.log('[Theme GET] Raw room data:', {
    theme_color: room.theme_color,
    background_type: room.background_type,
    background_value: room.background_value,
    background_opacity: room.background_opacity,
  })

  const result = {
    themeColor: room.theme_color || '#0A7CFF',
    backgroundType: room.background_type || 'default',
    backgroundValue: room.background_value || null,
    backgroundOpacity: room.background_opacity ?? 1.0,
  }

  console.log('[Theme GET] Returning:', result)
  return NextResponse.json(result)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is a participant in this room
  const { data: room, error: roomError } = await supabase
    .from('dm_rooms')
    .select('participant_1_id, participant_2_id')
    .eq('id', roomId)
    .single()

  if (roomError || !room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  }

  if (room.participant_1_id !== user.id && room.participant_2_id !== user.id) {
    return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
  }

  const body = await request.json()
  const { themeColor, backgroundType, backgroundValue, backgroundOpacity } = body

  // Validate theme color if provided
  if (themeColor && !VALID_THEME_COLORS.includes(themeColor)) {
    console.error('Invalid theme color:', themeColor)
    return NextResponse.json(
      { error: 'Invalid theme color' },
      { status: 400 }
    )
  }

  // Validate background type if provided
  if (backgroundType && !VALID_BACKGROUND_TYPES.includes(backgroundType)) {
    console.error('Invalid background type:', backgroundType)
    return NextResponse.json(
      { error: 'Invalid background type' },
      { status: 400 }
    )
  }

  // Build update object
  const updateData: Record<string, unknown> = {}
  if (themeColor) updateData.theme_color = themeColor
  if (backgroundType) updateData.background_type = backgroundType
  if (backgroundValue !== undefined) updateData.background_value = backgroundValue
  if (backgroundOpacity !== undefined) updateData.background_opacity = backgroundOpacity

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: 'No valid fields to update' },
      { status: 400 }
    )
  }

  console.log('[Theme PUT] Updating room:', roomId, 'with data:', updateData)

  // Authorization already verified above (user is a participant). RLS policy
  // "dm_rooms_participants_update" (migration 20260524000000) allows the
  // user-scoped client to perform this update.
  const { data: updated, error: updateError } = await supabase
    .from('dm_rooms')
    .update(updateData)
    .eq('id', roomId)
    .select('theme_color, background_type, background_value, background_opacity')

  if (updateError) {
    console.error('Failed to update theme:', updateError)
    return NextResponse.json(
      { error: 'Failed to update theme', details: updateError.message },
      { status: 500 }
    )
  }

  if (!updated || updated.length === 0) {
    console.error('[Theme PUT] Update affected 0 rows for room:', roomId)
    return NextResponse.json(
      { error: 'Theme update did not persist' },
      { status: 500 }
    )
  }

  const row = updated[0]
  console.log('[Theme PUT] Success - persisted row:', row)

  return NextResponse.json({
    themeColor: row.theme_color || '#0A7CFF',
    backgroundType: row.background_type || 'default',
    backgroundValue: row.background_value || null,
    backgroundOpacity: row.background_opacity ?? 1.0,
  })
}
