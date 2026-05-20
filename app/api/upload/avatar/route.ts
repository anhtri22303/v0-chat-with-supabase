import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const MAX_AVATAR_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}` },
      { status: 400 }
    )
  }

  if (file.size > MAX_AVATAR_SIZE) {
    return NextResponse.json(
      { error: 'Avatar too large. Maximum size is 5MB.' },
      { status: 400 }
    )
  }

  const ext = file.type === 'image/png'
    ? 'png'
    : file.type === 'image/webp'
      ? 'webp'
      : 'jpg'
  const filePath = `avatars/${user.id}/${Date.now()}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const { data, error } = await supabase.storage
    .from('chat-media')
    .upload(filePath, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    })

  if (error) {
    console.error('Avatar upload error:', error)
    return NextResponse.json(
      { error: `Upload failed: ${error.message}` },
      { status: 500 }
    )
  }

  const { data: publicUrlData } = supabase.storage
    .from('chat-media')
    .getPublicUrl(data.path)

  return NextResponse.json({
    url: publicUrlData.publicUrl,
    path: data.path,
  })
}
