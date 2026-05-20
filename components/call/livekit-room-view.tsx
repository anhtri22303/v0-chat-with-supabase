'use client'

import '@livekit/components-styles'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ParticipantTile,
  useTracks,
  useRoomContext,
  useLocalParticipant,
} from '@livekit/components-react'
import { RoomEvent, Track, type LocalTrackPublication } from 'livekit-client'
import { useEffect, useMemo, useState, useCallback } from 'react'
import type { CallMediaType } from '@/lib/call-types'
import { useTranslations } from 'next-intl'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Camera, CameraOff, FlipHorizontal } from 'lucide-react'

interface LiveKitRoomViewProps {
  token: string
  serverUrl: string
  callType: CallMediaType
  onDisconnected: () => void
  userAvatarUrl?: string | null
  userName?: string
}

export interface CameraControls {
  isEnabled: boolean
  facingMode: 'user' | 'environment'
  toggleCamera: () => void
  flipCamera: () => void
}

function ActiveSpeakerPulse() {
  const room = useRoomContext()
  const [level, setLevel] = useState(0)

  useEffect(() => {
    if (!room) return

    const handleSpeakers = () => {
      const speakers = room.activeSpeakers || []
      const remoteLevels = speakers
        .filter((participant) => !participant.isLocal)
        .map((participant) => participant.audioLevel || 0)
      const maxLevel = remoteLevels.length > 0 ? Math.max(...remoteLevels) : 0
      setLevel(maxLevel)
    }

    room.on(RoomEvent.ActiveSpeakersChanged, handleSpeakers)
    handleSpeakers()

    return () => {
      room.off(RoomEvent.ActiveSpeakersChanged, handleSpeakers)
    }
  }, [room])

  const style = useMemo(() => {
    const scale = 1 + Math.min(0.5, level * 2)
    const glow = 8 + Math.min(18, level * 40)
    return {
      transform: `scale(${scale})`,
      boxShadow: `0 0 ${glow}px rgba(16, 185, 129, 0.5)`,
    }
  }, [level])

  return (
    <div
      className="h-24 w-24 rounded-full bg-emerald-500/20 flex items-center justify-center text-4xl transition-transform duration-150"
      style={style}
      aria-hidden="true"
    >
      🎙️
    </div>
  )
}

function CameraControlBar({
  onControlsChange,
}: {
  onControlsChange?: (controls: CameraControls) => void
}) {
  const { localParticipant } = useLocalParticipant()
  const t = useTranslations('call')
  const [isEnabled, setIsEnabled] = useState(true)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [isFlipping, setIsFlipping] = useState(false)

  // Initialize camera with front-facing (user) mode
  useEffect(() => {
    if (!localParticipant) return
    
    const enableCamera = async () => {
      try {
        await localParticipant.setCameraEnabled(true, {
          facingMode: 'user',
        })
        setIsEnabled(true)
      } catch {
        // Fallback without facing mode if not supported
        try {
          await localParticipant.setCameraEnabled(true)
          setIsEnabled(true)
        } catch {
          setIsEnabled(false)
        }
      }
    }
    
    enableCamera()
  }, [localParticipant])

  const toggleCamera = useCallback(async () => {
    if (!localParticipant) return
    
    try {
      const newState = !isEnabled
      await localParticipant.setCameraEnabled(newState)
      setIsEnabled(newState)
    } catch {
      // Handle error silently
    }
  }, [localParticipant, isEnabled])

  const flipCamera = useCallback(async () => {
    if (!localParticipant || isFlipping) return
    
    setIsFlipping(true)
    try {
      const newFacingMode = facingMode === 'user' ? 'environment' : 'user'
      
      // Disable current camera
      await localParticipant.setCameraEnabled(false)
      
      // Re-enable with new facing mode
      await localParticipant.setCameraEnabled(true, {
        facingMode: newFacingMode,
      })
      
      setFacingMode(newFacingMode)
    } catch {
      // If flip fails, try to re-enable with current mode
      try {
        await localParticipant.setCameraEnabled(true)
      } catch {
        // Silent fail
      }
    } finally {
      setIsFlipping(false)
    }
  }, [localParticipant, facingMode, isFlipping])

  // Report controls to parent
  useEffect(() => {
    onControlsChange?.({
      isEnabled,
      facingMode,
      toggleCamera,
      flipCamera,
    })
  }, [isEnabled, facingMode, toggleCamera, flipCamera, onControlsChange])

  return (
    <div className="flex items-center justify-center gap-4 p-4">
      <Button
        size="icon"
        variant={isEnabled ? 'default' : 'destructive'}
        className="rounded-full h-14 w-14"
        onClick={toggleCamera}
        aria-label={isEnabled ? t('turnOffCamera') : t('turnOnCamera')}
      >
        {isEnabled ? <Camera className="h-6 w-6" /> : <CameraOff className="h-6 w-6" />}
      </Button>
      
      <Button
        size="icon"
        variant="secondary"
        className="rounded-full h-14 w-14 bg-white/20 hover:bg-white/30 text-white"
        onClick={flipCamera}
        disabled={isFlipping || !isEnabled}
        aria-label={t('flipCamera')}
      >
        <FlipHorizontal className="h-6 w-6" />
      </Button>
    </div>
  )
}

function VideoStage({
  userAvatarUrl,
  userName,
}: {
  userAvatarUrl?: string | null
  userName?: string
}) {
  const { localParticipant } = useLocalParticipant()
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: true })
  const localTrack = tracks.find((track) => track.participant.isLocal)
  const remotes = tracks.filter((track) => !track.participant.isLocal)
  const primary = remotes[0] || localTrack
  
  // Check if local camera is enabled
  const isLocalCameraEnabled = localParticipant?.isCameraEnabled ?? false

  return (
    <div className="relative h-full w-full">
      {/* Main video (remote or local if no remote) */}
      {primary ? (
        <ParticipantTile
          trackRef={primary}
          className="h-full w-full rounded-none"
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center text-white/60">
          <ConnectingLabel />
        </div>
      )}
      
      {/* Local PIP video */}
      <div className="absolute bottom-4 right-4 h-40 w-28 sm:h-48 sm:w-36 rounded-xl overflow-hidden border border-white/20 shadow-lg bg-black/50">
        {localTrack && isLocalCameraEnabled ? (
          <ParticipantTile trackRef={localTrack} className="h-full w-full" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Avatar className="h-20 w-20 sm:h-24 sm:w-24">
              <AvatarImage src={userAvatarUrl || undefined} alt={userName || 'You'} />
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                {(userName || 'Y')[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
      </div>
    </div>
  )
}

function ConnectingLabel() {
  const t = useTranslations('call')
  return <>{t('videoConnecting')}</>
}

export function LiveKitRoomView({
  token,
  serverUrl,
  callType,
  onDisconnected,
  userAvatarUrl,
  userName,
}: LiveKitRoomViewProps) {
  const t = useTranslations('call')

  if (!serverUrl) {
    return (
      <div className="flex items-center justify-center h-full text-destructive p-4 text-center">
        {t('missingServerUrl')}
      </div>
    )
  }

  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return (
      <div className="flex items-center justify-center h-full text-destructive p-4 text-center">
        {t('insecureContext')}
      </div>
    )
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect
      audio
      video={false} // We handle video manually with facing mode
      onDisconnected={onDisconnected}
      className="h-full w-full"
      data-lk-theme="default"
    >
      <RoomAudioRenderer />
      {callType === 'video' ? (
        <div className="flex flex-col h-full">
          <div className="flex-1 min-h-0">
            <VideoStage userAvatarUrl={userAvatarUrl} userName={userName} />
          </div>
          <CameraControlBar />
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
            <ActiveSpeakerPulse />
            <p className="text-lg font-medium">{t('audioCall')}</p>
          </div>
        </div>
      )}
    </LiveKitRoom>
  )
}
