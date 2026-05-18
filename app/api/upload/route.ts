import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Allow longer execution for large file uploads (Vercel default is 10s)
export const maxDuration = 60

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
]

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
  const roomId = formData.get('roomId') as string | null
  const roomType = formData.get('roomType') as string | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!roomId || !roomType) {
    return NextResponse.json({ error: 'roomId and roomType are required' }, { status: 400 })
  }

  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}` },
      { status: 400 }
    )
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File too large. Maximum size is 50MB.' },
      { status: 400 }
    )
  }

  // Generate unique file path
  const timestamp = Date.now()
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const filePath = `${roomType}/${roomId}/${user.id}/${timestamp}-${sanitizedName}`

  // Convert File to ArrayBuffer for upload
  const arrayBuffer = await file.arrayBuffer()

  const { data, error } = await supabase.storage
    .from('chat-media')
    .upload(filePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    console.error('Storage upload error:', error)
    return NextResponse.json(
      { error: `Upload failed: ${error.message}` },
      { status: 500 }
    )
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from('chat-media')
    .getPublicUrl(data.path)

  const mediaType = file.type.startsWith('image/') ? 'image' : 'video'

  return NextResponse.json({
    url: publicUrlData.publicUrl,
    mediaType,
    path: data.path,
  })
}
