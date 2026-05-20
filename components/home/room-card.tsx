'use client'

import { formatDistanceToNowStrict } from 'date-fns'
import Link from 'next/link'
import { MessageCircle, Users, Camera, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useLocale, useTranslations } from 'next-intl'
import { usePresence } from '@/contexts/presence-context'

interface RoomCardProps {
  room: {
    type: 'dm' | 'group'
    id: string
    name: string
    last_message: string
    last_message_time: string
    member_count?: number
    description?: string
    avatar_url?: string
    participant?: { id: string; username: string }
  }
  isActive?: boolean
  isUnseen?: boolean
}

export function RoomCard({ room, isActive, isUnseen }: RoomCardProps) {
  const locale = useLocale()
  const t = useTranslations('notifications')
  const { isOnline } = usePresence()
  const showOnlineDot = room.type === 'dm' && !!room.participant?.id && isOnline(room.participant.id)
  const href = room.type === 'dm' ? `/${locale}/dm/${room.id}` : `/${locale}/clubs/${room.id}`
  const timeAgo = formatDistanceToNowStrict(new Date(room.last_message_time))
  const sentPhoto = t('sentPhoto')
  const sentVideo = t('sentVideo')
  const photoPrefix = t('photoPrefix')
  const videoPrefix = t('videoPrefix')

  return (
    <Link href={href} className="block">
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer relative",
          isActive
            ? "bg-accent/80"
            : "hover:bg-accent/40",
          isUnseen && !isActive
            ? "bg-sky-500/10 border border-sky-500/30 shadow-[0_0_12px_-3px_rgba(14,165,233,0.15)]"
            : "border border-transparent"
        )}
      >
        {/* Unseen accent bar */}
        {isUnseen && !isActive && (
          <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-sky-500" />
        )}

        <div className="relative flex-shrink-0">
          <Avatar className={cn(
            "h-12 w-12 border-2 transition-colors",
            isUnseen && !isActive
              ? "border-sky-500/50"
              : "border-border/50"
          )}>
            <AvatarImage src={room.avatar_url} />
            <AvatarFallback className={room.type === 'group' ? 'bg-primary/10 text-primary' : ''}>
              {room.type === 'group' ? <Users className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
            </AvatarFallback>
          </Avatar>
          {showOnlineDot && (
            <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-card" />
          )}
        </div>
        
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <h3 className={cn(
              "font-medium text-[15px] truncate",
              isUnseen && "font-bold text-foreground"
            )}>
              {room.name}
            </h3>
            <span className={cn(
              "text-[11px] whitespace-nowrap",
              isUnseen ? "font-semibold text-sky-400" : "text-muted-foreground"
            )}>
              {timeAgo}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <p className={cn(
              "text-[13px] truncate flex items-center gap-1",
              isUnseen ? "font-semibold text-foreground" : "text-muted-foreground"
            )}>
              {(room.last_message === sentPhoto || room.last_message.startsWith(photoPrefix)) && (
                <Camera className="h-3.5 w-3.5 flex-shrink-0 text-sky-400" />
              )}
              {(room.last_message === sentVideo || room.last_message.startsWith(videoPrefix)) && (
                <Video className="h-3.5 w-3.5 flex-shrink-0 text-sky-400" />
              )}
              <span className="truncate">{room.last_message}</span>
            </p>
            {isUnseen && (
              <div className="relative flex-shrink-0 ml-auto">
                <div className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                <div className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-sky-500 animate-ping opacity-75" />
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
