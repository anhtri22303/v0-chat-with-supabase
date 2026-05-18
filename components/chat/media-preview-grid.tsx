'use client'

import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Film } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MediaItem {
  id: string
  media_url: string
  media_type: 'image' | 'video'
  content?: string
  created_at: string
}

interface MediaPreviewGridProps {
  roomType: 'dm' | 'club'
  roomId: string
  limit?: number
  onViewAll?: () => void
  className?: string
}

export function MediaPreviewGrid({
  roomType,
  roomId,
  limit = 6,
  onViewAll,
  className,
}: MediaPreviewGridProps) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)

  const apiBase = roomType === 'dm' ? `/api/dm/rooms/${roomId}` : `/api/club/${roomId}`

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiBase}/media?limit=${limit}`)
        if (res.ok) {
          const data = await res.json()
          setItems(data.media || [])
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [apiBase, limit])

  if (loading) {
    return (
      <div className={cn('grid grid-cols-3 gap-1', className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-md" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Chưa có file phương tiện nào được chia sẻ.
      </p>
    )
  }

  const display = items.slice(0, limit)

  return (
    <div className={className}>
      <div className="grid grid-cols-3 gap-1 rounded-lg overflow-hidden">
        {display.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={onViewAll}
            className={cn(
              'relative aspect-square bg-muted overflow-hidden',
              i === 0 && display.length >= 3 && 'col-span-2 row-span-2 aspect-auto min-h-[120px]'
            )}
          >
            {item.media_type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.media_url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <Film className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
