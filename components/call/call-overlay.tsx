'use client'

import { Button } from '@/components/ui/button'
import { Phone, PhoneOff, Video } from 'lucide-react'
import { LiveKitRoomView } from './livekit-room-view'
import type { ActiveCallState } from '@/lib/call-types'

interface CallOverlayProps {
  activeCall: ActiveCallState
  onEndCall: () => void
  onToggleCallType: () => void
  isSwitching?: boolean
  onDisconnected: () => void
}

export function CallOverlay({
  activeCall,
  onEndCall,
  onToggleCallType,
  isSwitching,
  onDisconnected,
}: CallOverlayProps) {
  const label =
    activeCall.session.call_type === 'video' ? 'Cuộc gọi video' : 'Cuộc gọi thoại'

  const isVideo = activeCall.session.call_type === 'video'

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 text-white shrink-0 z-10">
        <div>
          <p className="font-semibold">{label}</p>
          <p className="text-xs text-white/70">
            {activeCall.session.room_type === 'club' ? 'Nhóm' : 'Trực tiếp'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full h-10 w-10 text-white hover:bg-white/10"
            onClick={() => onToggleCallType()}
            disabled={isSwitching}
            aria-label={isVideo ? 'Chuyển sang thoại' : 'Chuyển sang video'}
          >
            {isVideo ? <Phone className="h-4 w-4" /> : <Video className="h-4 w-4" />}
          </Button>
          <Button
            variant="destructive"
            size="icon"
            className="rounded-full h-12 w-12"
            onClick={onEndCall}
            aria-label="Kết thúc cuộc gọi"
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <LiveKitRoomView
          token={activeCall.token}
          serverUrl={activeCall.serverUrl}
          callType={activeCall.session.call_type}
          onDisconnected={onDisconnected}
        />
      </div>
    </div>
  )
}
