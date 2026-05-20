import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/blocks - Get list of blocked users
export async function GET() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: blocks, error } = await supabase
    .from('user_blocks')
    .select(`
      id,
      blocked_id,
      created_at,
      blocked_user:blocked_id (
        id,
        username,
        avatar_url
      )
    `)
    .eq('blocker_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching blocks:', error)
    return NextResponse.json({ error: 'Failed to fetch blocks' }, { status: 500 })
  }

  return NextResponse.json({ blocks: blocks || [] })
}

// POST /api/blocks - Block a user
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { blocked_id } = await request.json()
    
    if (!blocked_id) {
      return NextResponse.json({ error: 'blocked_id is required' }, { status: 400 })
    }

    // Prevent blocking yourself
    if (blocked_id === user.id) {
      return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 })
    }

    // Check if user exists
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', blocked_id)
      .single()

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if already blocked
    const { data: existing } = await supabase
      .from('user_blocks')
      .select('id')
      .eq('blocker_id', user.id)
      .eq('blocked_id', blocked_id)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'User already blocked' }, { status: 409 })
    }

    // Create block
    const { data: block, error } = await supabase
      .from('user_blocks')
      .insert({
        blocker_id: user.id,
        blocked_id: blocked_id,
      })
      .select(`
        id,
        blocked_id,
        created_at,
        blocked_user:blocked_id (
          id,
          username,
          avatar_url
        )
      `)
      .single()

    if (error) {
      console.error('Error blocking user:', error)
      return NextResponse.json({ error: 'Failed to block user' }, { status: 500 })
    }

    return NextResponse.json({ block }, { status: 201 })
  } catch (err) {
    console.error('Error in block POST:', err)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
