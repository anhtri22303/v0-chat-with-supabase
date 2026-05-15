import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const query = request.nextUrl.searchParams.get('q')

  if (!query || query.length < 2) {
    return NextResponse.json({ users: [] })
  }

  try {
    const adminClient = createAdminClient()
    const { data: users, error } = await adminClient
      .from('users')
      .select('id, username, avatar_url')
      .or(`username.ilike.%${query}%,email.ilike.%${query}%`)
      .neq('id', user.id)
      .limit(10)

    console.log('[user-search] query:', query, 'resultCount:', users?.length ?? 0)

    if (error) {
      console.error('[user-search] error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error searching users:', error)
    return NextResponse.json(
      { error: 'Failed to search users' },
      { status: 500 }
    )
  }
}
