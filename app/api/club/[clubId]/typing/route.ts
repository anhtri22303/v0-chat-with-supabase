import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
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

  const body = await request.json()
  const { isTyping } = body

  if (typeof isTyping !== 'boolean') {
    return NextResponse.json(
      { error: 'isTyping must be a boolean' },
      { status: 400 }
    )
  }

  if (isTyping) {
    // Upsert typing indicator
    const { error } = await supabase.from('club_typing_indicators').upsert(
      {
        club_id: clubId,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'club_id,user_id',
      }
    )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else {
    // Delete typing indicator
    const { error } = await supabase
      .from('club_typing_indicators')
      .delete()
      .eq('club_id', clubId)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
