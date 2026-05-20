'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'

interface AvatarEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentAvatarUrl: string | null
  username: string
  onSaved: (newUrl: string) => void
}

const VIEWPORT = 280 // px (visible square crop area)
const OUTPUT = 512 // px (final exported avatar size)

export function AvatarEditModal({
  open,
  onOpenChange,
  currentAvatarUrl,
  username,
  onSaved,
}: AvatarEditModalProps) {
  const t = useTranslations('profile')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [imageNatural, setImageNatural] = useState<{ w: number; h: number } | null>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const [uploading, setUploading] = useState(false)

  // Reset state when closing/opening
  useEffect(() => {
    if (!open) {
      setImageSrc(null)
      setImageNatural(null)
      setScale(1)
      setOffset({ x: 0, y: 0 })
      setUploading(false)
    }
  }, [open])

  const handleFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error(t('invalidFile'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setImageSrc(reader.result as string)
      setOffset({ x: 0, y: 0 })
      setScale(1)
    }
    reader.readAsDataURL(file)
  }, [t])

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setImageNatural({ w: img.naturalWidth, h: img.naturalHeight })
    // Initial scale: cover the viewport
    const cover = Math.max(VIEWPORT / img.naturalWidth, VIEWPORT / img.naturalHeight)
    setScale(cover)
    setOffset({ x: 0, y: 0 })
  }

  const minScale = imageNatural
    ? Math.max(VIEWPORT / imageNatural.w, VIEWPORT / imageNatural.h)
    : 1
  const maxScale = minScale * 4

  // Clamp offset so image always covers viewport
  const clampOffset = useCallback((next: { x: number; y: number }, s: number) => {
    if (!imageNatural) return next
    const w = imageNatural.w * s
    const h = imageNatural.h * s
    const maxX = (w - VIEWPORT) / 2
    const maxY = (h - VIEWPORT) / 2
    return {
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    }
  }, [imageNatural])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!imageSrc) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      ox: offset.x,
      oy: offset.y,
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    setOffset(clampOffset(
      { x: dragStartRef.current.ox + dx, y: dragStartRef.current.oy + dy },
      scale
    ))
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false)
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
  }

  const handleScaleChange = (val: number[]) => {
    const next = val[0]
    setScale(next)
    setOffset((prev) => clampOffset(prev, next))
  }

  const exportCroppedBlob = useCallback(async (): Promise<Blob | null> => {
    if (!imageNatural || !imgRef.current) return null
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT
    canvas.height = OUTPUT
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // Map: viewport center is (offset.x, offset.y) in image-display coordinates.
    // Source rectangle in natural image space:
    const srcSize = VIEWPORT / scale
    const cxNatural = imageNatural.w / 2 - offset.x / scale
    const cyNatural = imageNatural.h / 2 - offset.y / scale
    const sx = cxNatural - srcSize / 2
    const sy = cyNatural - srcSize / 2

    ctx.drawImage(
      imgRef.current,
      sx,
      sy,
      srcSize,
      srcSize,
      0,
      0,
      OUTPUT,
      OUTPUT
    )

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.9)
    })
  }, [imageNatural, scale, offset])

  const handleSave = async () => {
    if (!imageSrc) return
    try {
      setUploading(true)
      const blob = await exportCroppedBlob()
      if (!blob) throw new Error('Failed to crop image')

      const file = new File([blob], `avatar-${Date.now()}.webp`, { type: 'image/webp' })
      const formData = new FormData()
      formData.append('file', file)

      const uploadRes = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formData,
      })
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}))
        throw new Error(err.error || 'Upload failed')
      }
      const { url } = await uploadRes.json()

      const patchRes = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: url }),
      })
      if (!patchRes.ok) {
        const err = await patchRes.json().catch(() => ({}))
        throw new Error(err.error || 'Update failed')
      }

      toast.success(t('uploaded'))
      onSaved(url)
      onOpenChange(false)
    } catch (err) {
      console.error('Avatar save error:', err)
      toast.error(err instanceof Error ? err.message : t('uploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('editAvatar')}</DialogTitle>
          <DialogDescription>{t('editAvatarDesc')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {!imageSrc ? (
            <>
              <Avatar className="h-32 w-32 border-2 border-border">
                <AvatarImage src={currentAvatarUrl || undefined} alt={username} />
                <AvatarFallback className="text-3xl">
                  {username[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {t('choosePhoto')}
              </Button>
            </>
          ) : (
            <>
              <div
                ref={containerRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="relative bg-black rounded-lg overflow-hidden touch-none select-none"
                style={{
                  width: VIEWPORT,
                  height: VIEWPORT,
                  cursor: isDragging ? 'grabbing' : 'grab',
                }}
              >
                {imageNatural && (
                  <img
                    ref={imgRef}
                    src={imageSrc}
                    alt="crop preview"
                    onLoad={onImgLoad}
                    draggable={false}
                    className="absolute pointer-events-none"
                    style={{
                      width: imageNatural.w * scale,
                      height: imageNatural.h * scale,
                      left: '50%',
                      top: '50%',
                      transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                    }}
                  />
                )}
                {!imageNatural && (
                  <img
                    ref={imgRef}
                    src={imageSrc}
                    alt="loading"
                    onLoad={onImgLoad}
                    className="hidden"
                  />
                )}

                {/* Circular mask overlay */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    boxShadow: `0 0 0 9999px rgba(0,0,0,0.55)`,
                    borderRadius: '50%',
                    margin: 0,
                  }}
                />
                <div className="absolute inset-0 pointer-events-none rounded-full border-2 border-white/80" />
              </div>

              <div className="w-full px-2">
                <label className="text-xs text-muted-foreground mb-1 block">
                  {t('zoom')}
                </label>
                <Slider
                  min={minScale}
                  max={maxScale}
                  step={0.01}
                  value={[scale]}
                  onValueChange={handleScaleChange}
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                {t('changePhoto')}
              </Button>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFilePick}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={uploading}
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!imageSrc || uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('uploading')}
              </>
            ) : (
              t('save')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
