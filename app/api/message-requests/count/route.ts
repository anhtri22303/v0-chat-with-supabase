import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/message-requests/count - Get count of new and spam message requests
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get count of new message requests
    const { count: newCount, error: newError } = await supabase
      .from('message_requests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'new')

    if (newError) {
      console.error('Error counting new message requests:', newError)
      return NextResponse.json({ error: newError.message }, { status: 500 })
    }

    // Get count of spam message requests
    const { count: spamCount, error: spamError } = await supabase
      .from('message_requests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'spam')

    if (spamError) {
      console.error('Error counting spam message requests:', spamError)
      return NextResponse.json({ error: spamError.message }, { status: 500 })
    }

    return NextResponse.json({
      new: newCount || 0,
      spam: spamCount || 0,
      total: (newCount || 0) + (spamCount || 0),
    })
  } catch (error) {
    console.error('Error counting message requests:', error)
    return NextResponse.json(
      { error: 'Failed to count message requests' },
      { status: 500 }
    )
  }
}
