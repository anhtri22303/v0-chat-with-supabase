'use client'

import { Button } from '@/components/ui/button'
import { Phone, PhoneOff, Video, Mic, MicOff } from 'lucide-react'
import { LiveKitRoomView } from './livekit-room-view'
import type { ActiveCallState } from '@/lib/call-types'
import { useTranslations } from 'next-intl'
import { useState, useCallback } from 'react'
import { useLocalParticipant } from '@livekit/components-react'

interface CallOverlayProps {
  activeCall: ActiveCallState
  onEndCall: () => void
  onToggleCallType: () => void
  isSwitching?: boolean
  onDisconnected: () => void
  userAvatarUrl?: string | null
  userName?: string
}

function AudioControlButton() {
  const { localParticipant } = useLocalParticipant()
  const t = useTranslations('call')
  const [isMuted, setIsMuted] = useState(false)

  const toggleAudio = useCallback(async () => {
    if (!localParticipant) return
    
    try {
      const newState = !isMuted
      await localParticipant.setMicrophoneEnabled(newState)
      setIsMuted(!newState)
    } catch {
      // Handle error silently
    }
  }, [localParticipant, isMuted])

  return (
    <Button
      size="icon"
      variant={isMuted ? 'destructive' : 'secondary'}
      className="rounded-full h-14 w-14 bg-white/20 hover:bg-white/30 text-white"
      onClick={toggleAudio}
      aria-label={isMuted ? t('unmute') : t('mute')}
    >
      {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
    </Button>
  )
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
          userAvatarUrl={userAvatarUrl}
          userName={userName}
        />
      </div>

      {/* Bottom control bar */}
      <div className="flex items-center justify-center gap-6 p-6 bg-black/80 shrink-0">
        <AudioControlButton />
        <Button
          variant="destructive"
          size="icon"
          className="rounded-full h-16 w-16"
          onClick={onEndCall}
          aria-label={t('endCall')}
        >
          <PhoneOff className="h-7 w-7" />
        </Button>
      </div>
    </div>
  )
}
