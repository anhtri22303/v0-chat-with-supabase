'use client'

import { Button } from '@/components/ui/button'
import { Phone, PhoneOff, Video } from 'lucide-react'
import { LiveKitRoomView } from './livekit-room-view'
import type { ActiveCallState } from '@/lib/call-types'
import { useTranslations } from 'next-intl'

interface CallOverlayProps {
  activeCall: ActiveCallState
  onEndCall: () => void
  onToggleCallType: () => void
  isSwitching?: boolean
  onDisconnected: () => void
  userAvatarUrl?: string | null
  userName?: string
}

export function CallOverlay({
  activeCall,
  onEndCall,
  onToggleCallType,
  isSwitching,
  onDisconnected,
  userAvatarUrl,
  userName,
}: CallOverlayProps) {
  const t = useTranslations('call')
  const label =
    activeCall.session.call_type === 'video' ? t('videoCall') : t('audioCall')

  const isVideo = activeCall.session.call_type === 'video'

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 text-white shrink-0 z-10">
        <div>
          <p className="font-semibold">{label}</p>
          <p className="text-xs text-white/70">
            {activeCall.session.room_type === 'club' ? t('group') : t('direct')}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full h-10 w-10 text-white hover:bg-white/10"
          onClick={() => onToggleCallType()}
          disabled={isSwitching}
          aria-label={isVideo ? t('switchToAudio') : t('switchToVideo')}
        >
          {isVideo ? <Phone className="h-4 w-4" /> : <Video className="h-4 w-4" />}
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0">
        <LiveKitRoomView
          token={activeCall.token}
          serverUrl={activeCall.serverUrl}
          callType={activeCall.session.call_type}
          onDisconnected={onDisconnected}
          onEndCall={onEndCall}
          userAvatarUrl={userAvatarUrl}
          userName={userName}
        />
      </div>

    </div>
  )
}
