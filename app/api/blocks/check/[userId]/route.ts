import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/blocks/check/[userId] - Check if a user is blocked or blocking you
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if current user has blocked target user
  const { data: hasBlocked } = await supabase
    .from('user_blocks')
    .select('id')
    .eq('blocker_id', user.id)
    .eq('blocked_id', userId)
    .single()

  // Check if target user has blocked current user
  const { data: isBlockedBy } = await supabase
    .from('user_blocks')
    .select('id')
    .eq('blocker_id', userId)
    .eq('blocked_id', user.id)
    .single()

  return NextResponse.json({
    hasBlocked: !!hasBlocked,
    isBlockedBy: !!isBlockedBy,
    canInteract: !hasBlocked && !isBlockedBy,
  })
}
