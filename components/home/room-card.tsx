'use client'

import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { MessageCircle, Users } from 'lucide-react'

interface RoomCardProps {
  room: {
    type: 'dm' | 'group'
    id: string
    name: string
    last_message: string
    last_message_time: string
    member_count?: number
    description?: string
  }
  isActive?: boolean
}

export function RoomCard({ room, isActive }: RoomCardProps) {
  const href = room.type === 'dm' ? `/dm/${room.id}` : `/clubs/${room.id}`
  const timeAgo = formatDistanceToNow(new Date(room.last_message_time), {
    addSuffix: true,
  })

  return (
    <Link href={href}>
      <Card
        className={
          `hover:bg-accent transition-colors cursor-pointer h-full ` +
          (isActive ? 'border-primary/60 bg-accent/40' : '')
        }
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {room.type === 'group' ? (
                  <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <MessageCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <h3 className="font-semibold truncate">{room.name}</h3>
              </div>

              {room.type === 'group' && room.description && (
                <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                  {room.description}
                </p>
              )}

              <p className="text-sm text-muted-foreground line-clamp-2">
                {room.last_message}
              </p>

              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <span>{timeAgo}</span>
                {room.type === 'group' && room.member_count && (
                  <>
                    <span>•</span>
                    <span>{room.member_count} members</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
