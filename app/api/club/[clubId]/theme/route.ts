import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Valid Messenger-style theme colors
const VALID_THEME_COLORS = [
  '#0A7CFF', // Messenger Blue (default)
  '#FF0000', // Red
  '#FF8C00', // Orange
  '#FFD700', // Yellow
  '#32CD32', // Green
  '#00CED1', // Cyan
  '#4169E1', // Royal Blue
  '#8A2BE2', // Blue Violet
  '#FF1493', // Deep Pink
  '#FF69B4', // Hot Pink
  '#9370DB', // Medium Purple
  '#20B2AA', // Light Sea Green
]

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
    .select('theme_color')
    .eq('id', clubId)
    .single()

  if (clubError || !club) {
    return NextResponse.json({ error: 'Club not found' }, { status: 404 })
  }

  return NextResponse.json({ themeColor: club.theme_color || '#0A7CFF' })
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
  const { themeColor } = body

  if (!themeColor || !VALID_THEME_COLORS.includes(themeColor)) {
    return NextResponse.json(
      { error: 'Invalid theme color' },
      { status: 400 }
    )
  }

  const { error: updateError } = await supabase
    .from('clubs')
    .update({ theme_color: themeColor })
    .eq('id', clubId)

  if (updateError) {
    return NextResponse.json(
      { error: 'Failed to update theme' },
      { status: 500 }
    )
  }

  return NextResponse.json({ themeColor })
}
