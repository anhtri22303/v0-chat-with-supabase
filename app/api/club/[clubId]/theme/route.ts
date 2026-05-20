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
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is a member of this club
  const { data: membership, error: membershipError } = await supabase
    .from('club_members')
    .select('id')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .single()

  if (membershipError || !membership) {
    return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  }

  const { data: club, error: clubError } = await supabase
    .from('clubs')
    .select('theme_color, background_type, background_value, background_opacity')
    .eq('id', clubId)
    .single()

  if (clubError || !club) {
    return NextResponse.json({ error: 'Club not found' }, { status: 404 })
  }

  return NextResponse.json({ 
    themeColor: club.theme_color || '#0A7CFF',
    backgroundType: club.background_type || 'default',
    backgroundValue: club.background_value || null,
    backgroundOpacity: club.background_opacity ?? 1.0,
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is a member of this club
  const { data: membership, error: membershipError } = await supabase
    .from('club_members')
    .select('id, role')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .single()

  if (membershipError || !membership) {
    return NextResponse.json({ error: 'Not a member' }, { status: 403 })
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

  // Authorization already verified above (user is a club member). RLS policy
  // "clubs_members_update" (migration 20260524000000) allows the user-scoped
  // client to perform this update.
  const { data: updated, error: updateError } = await supabase
    .from('clubs')
    .update(updateData)
    .eq('id', clubId)
    .select('theme_color, background_type, background_value, background_opacity')

  if (updateError) {
    console.error('Failed to update theme:', updateError)
    return NextResponse.json(
      { error: 'Failed to update theme', details: updateError.message },
      { status: 500 }
    )
  }

  if (!updated || updated.length === 0) {
    console.error('[Club Theme PUT] Update affected 0 rows for club:', clubId)
    return NextResponse.json(
      { error: 'Theme update did not persist' },
      { status: 500 }
    )
  }

  const row = updated[0]
  return NextResponse.json({
    themeColor: row.theme_color || '#0A7CFF',
    backgroundType: row.background_type || 'default',
    backgroundValue: row.background_value || null,
    backgroundOpacity: row.background_opacity ?? 1.0,
  })
}
