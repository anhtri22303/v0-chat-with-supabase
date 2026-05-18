import imageCompression from 'browser-image-compression'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const IMAGE_COMPRESS_MAX_SIZE_MB = 1
const IMAGE_COMPRESS_MAX_DIMENSION = 1920
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp']
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']

export type MediaType = 'image' | 'video'

export interface MediaValidationResult {
  valid: boolean
  error?: string
  mediaType?: MediaType
}

export function getMediaType(file: File): MediaType | null {
  if (ALLOWED_IMAGE_TYPES.includes(file.type)) return 'image'
  if (ALLOWED_VIDEO_TYPES.includes(file.type)) return 'video'
  return null
}

export function validateMediaFile(file: File): MediaValidationResult {
  const mediaType = getMediaType(file)

  if (!mediaType) {
    return {
      valid: false,
      error: `Unsupported file type: ${file.type || 'unknown'}. Allowed: images (JPEG, PNG, WebP, GIF) and videos (MP4, WebM, MOV).`,
    }
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large (${formatFileSize(file.size)}). Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.`,
    }
  }

  return { valid: true, mediaType }
}

export async function compressImage(
  file: File,
  onProgress?: (progress: number) => void
): Promise<File> {
  // Skip compression for GIFs (would lose animation)
  if (file.type === 'image/gif') {
    return file
  }

  // Skip if already small enough
  if (file.size <= IMAGE_COMPRESS_MAX_SIZE_MB * 1024 * 1024) {
    return file
  }

  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: IMAGE_COMPRESS_MAX_SIZE_MB,
      maxWidthOrHeight: IMAGE_COMPRESS_MAX_DIMENSION,
      useWebWorker: true,
      onProgress,
      fileType: file.type as string,
    })

    return compressed as File
  } catch (err) {
    console.error('Image compression failed, using original:', err)
    return file
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function createObjectURL(file: File): string {
  return URL.createObjectURL(file)
}

export function revokeObjectURL(url: string): void {
  URL.revokeObjectURL(url)
}
