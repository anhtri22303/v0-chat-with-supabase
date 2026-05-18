'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ArrowLeft, Info, Phone, Video } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatHeaderProps {
  title: string
  subtitle?: string
  avatarUrl?: string | null
  avatarFallback?: React.ReactNode
  showBack?: boolean
  onBack?: () => void
  onInfoClick: () => void
  onVoiceCall?: () => void
  onVideoCall?: () => void
  activeCallBadge?: boolean
  onJoinActiveCall?: () => void
}

export function ChatHeader({
  title,
  subtitle,
  avatarUrl,
  avatarFallback,
  showBack = false,
  onBack,
  onInfoClick,
  onVoiceCall,
  onVideoCall,
  activeCallBadge,
  onJoinActiveCall,
}: ChatHeaderProps) {
  const t = useTranslations('chatHeader')

  return (
    <header className="border-b bg-card shrink-0">
      <div className="px-4 py-3 flex items-center gap-2">
        {showBack && onBack && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden mr-0 shrink-0"
            onClick={onBack}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}

        <button
          type="button"
          onClick={onInfoClick}
          className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-lg hover:bg-muted/50 transition-colors -mx-1 px-1 py-0.5"
        >
          {avatarFallback ? (
            avatarFallback
          ) : (
            <Avatar className="h-10 w-10 border border-border shrink-0">
              <AvatarImage src={avatarUrl || undefined} alt={title} />
              <AvatarFallback>{title[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold leading-none truncate">{title}</h1>
              {activeCallBadge && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onJoinActiveCall?.()
                  }}
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-600 text-white shrink-0 hover:bg-green-700"
                >
                  {t('joinCall')}
                </button>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>
            )}
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          {onVoiceCall && (
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full h-9 w-9"
              onClick={onVoiceCall}
              aria-label={t('voiceCall')}
            >
              <Phone className="h-4 w-4" />
            </Button>
          )}
          {onVideoCall && (
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full h-9 w-9"
              onClick={onVideoCall}
              aria-label={t('videoCall')}
            >
              <Video className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="secondary"
            className={cn(
              'rounded-full h-9 w-9',
              'bg-muted text-foreground hover:bg-muted/80',
              'dark:bg-zinc-700 dark:hover:bg-zinc-600'
            )}
            onClick={onInfoClick}
            aria-label={t('chatInfo')}
          >
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
