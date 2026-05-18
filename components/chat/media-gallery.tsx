'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Film, Loader2 } from 'lucide-react'
import type { MediaItem } from './media-preview-grid'

interface MediaGalleryProps {
  roomType: 'dm' | 'club'
  roomId: string
}

export function MediaGallery({ roomType, roomId }: MediaGalleryProps) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [lightbox, setLightbox] = useState<MediaItem | null>(null)

  const apiBase = roomType === 'dm' ? `/api/dm/rooms/${roomId}` : `/api/club/${roomId}`

  const loadMedia = useCallback(async (offset: number, append: boolean) => {
    const res = await fetch(`${apiBase}/media?limit=20&offset=${offset}`)
    if (!res.ok) return
    const data = await res.json()
    setTotal(data.total ?? 0)
    setItems((prev) => (append ? [...prev, ...(data.media || [])] : data.media || []))
  }, [apiBase])

  useEffect(() => {
    setLoading(true)
    loadMedia(0, false).finally(() => setLoading(false))
  }, [loadMedia])

  const loadMore = async () => {
    setLoadingMore(true)
    await loadMedia(items.length, true)
    setLoadingMore(false)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-md" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có media nào.</p>
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setLightbox(item)}
            className="relative aspect-square rounded-md overflow-hidden bg-muted"
          >
            {item.media_type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.media_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Film className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </button>
        ))}
      </div>

      {items.length < total && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-3"
          onClick={loadMore}
          disabled={loadingMore}
        >
          {loadingMore && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Xem thêm
        </Button>
      )}

      <Dialog open={!!lightbox} onOpenChange={() => setLightbox(null)}>
        <DialogContent className="max-w-3xl p-2 bg-black/95 border-none">
          <DialogTitle className="sr-only">Media preview</DialogTitle>
          {lightbox?.media_type === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lightbox.media_url}
              alt=""
              className="w-full max-h-[80vh] object-contain rounded"
            />
          ) : lightbox?.media_type === 'video' ? (
            <video
              src={lightbox.media_url}
              controls
              className="w-full max-h-[80vh] rounded"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
