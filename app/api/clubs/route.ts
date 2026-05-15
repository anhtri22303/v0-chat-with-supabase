import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { name, description, memberIds } = await request.json()

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Group name is required' },
        { status: 400 }
      )
    }

    // Create the club
    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .insert({
        name: name.trim(),
        description: description || null,
      })
      .select()
      .single()

    if (clubError) throw clubError

    // Add creator as leader
    const { error: creatorError } = await supabase
      .from('club_members')
      .insert({
        club_id: club.id,
        user_id: user.id,
        role: 'leader',
      })

    if (creatorError) throw creatorError

    // Add other members if provided
    if (Array.isArray(memberIds) && memberIds.length > 0) {
      const uniqueMembers = Array.from(new Set(memberIds)).filter(
        (id) => id !== user.id
      )

      if (uniqueMembers.length > 0) {
        const membersToAdd = uniqueMembers.map((memberId) => ({
          club_id: club.id,
          user_id: memberId,
          role: 'member',
        }))

        const { error: membersError } = await supabase
          .from('club_members')
          .insert(membersToAdd)

        if (membersError) throw membersError
      }
    }

    return NextResponse.json({ club }, { status: 201 })
  } catch (error) {
    console.error('Error creating club:', error)
    return NextResponse.json(
      { error: 'Failed to create group' },
      { status: 500 }
    )
  }
}
