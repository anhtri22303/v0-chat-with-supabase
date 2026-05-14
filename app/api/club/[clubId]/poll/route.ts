import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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

  // Check if user is member of club
  const { data: membership } = await supabase
    .from('club_members')
    .select('id')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const after = searchParams.get('after')

  if (!after) {
    return NextResponse.json({ error: 'Missing after parameter' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('club_messages')
    .select(
      `
      id,
      content,
      user_id,
      created_at,
      users:user_id(username, avatar_url),
      club_message_reactions(emoji, user_id),
      club_message_replies(id)
    `
    )
    .eq('club_id', clubId)
    .is('deleted_at', null)
    .gt('created_at', after)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Also get typing indicators
  const { data: typingData } = await supabase
    .from('club_typing_indicators')
    .select('user_id, updated_at, users:user_id(username)')
    .eq('club_id', clubId)
    .gt('updated_at', new Date(Date.now() - 5000).toISOString())

  return NextResponse.json({
    messages: data || [],
    typing: typingData || [],
    timestamp: new Date().toISOString(),
  })
}
