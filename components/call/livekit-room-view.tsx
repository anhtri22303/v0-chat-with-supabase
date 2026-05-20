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
import { RoomEvent, Track } from 'livekit-client'
import { useEffect, useMemo, useState, useCallback } from 'react'
import type { CallMediaType } from '@/lib/call-types'
import { useTranslations } from 'next-intl'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Camera, CameraOff, FlipHorizontal, Mic, MicOff, PhoneOff } from 'lucide-react'

interface LiveKitRoomViewProps {
  token: string
  serverUrl: string
  callType: CallMediaType
  onDisconnected: () => void
  onEndCall?: () => void
  userAvatarUrl?: string | null
  userName?: string
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

function AudioControlButton() {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant()
  const t = useTranslations('call')

  const toggleAudio = useCallback(async () => {
    if (!localParticipant) return

    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
    } catch {
      // Handle error silently
    }
  }, [localParticipant, isMicrophoneEnabled])

  const isMuted = !isMicrophoneEnabled

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

function CameraToggleButton() {
  const { localParticipant, isCameraEnabled } = useLocalParticipant()
  const t = useTranslations('call')

  const toggleCamera = useCallback(async () => {
    if (!localParticipant) return
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled)
    } catch {
      // Handle error silently
    }
  }, [localParticipant, isCameraEnabled])

  return (
    <Button
      size="icon"
      variant={isCameraEnabled ? 'secondary' : 'destructive'}
      className="rounded-full h-14 w-14 bg-white/20 hover:bg-white/30 text-white"
      onClick={toggleCamera}
      aria-label={isCameraEnabled ? t('turnOffCamera') : t('turnOnCamera')}
    >
      {isCameraEnabled ? <Camera className="h-6 w-6" /> : <CameraOff className="h-6 w-6" />}
    </Button>
  )
}

function FlipCameraButton({ isCameraEnabled }: { isCameraEnabled: boolean }) {
  const { localParticipant } = useLocalParticipant()
  const t = useTranslations('call')
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [isFlipping, setIsFlipping] = useState(false)

  // Initialize camera with front-facing (user) mode
  useEffect(() => {
    if (!localParticipant) return

    const enableCamera = async () => {
      try {
        await localParticipant.setCameraEnabled(true, { facingMode: 'user' })
      } catch {
        try {
          await localParticipant.setCameraEnabled(true)
        } catch {
          // Silent fail
        }
      }
    }

    enableCamera()
  }, [localParticipant])

  const flipCamera = useCallback(async () => {
    if (!localParticipant || isFlipping) return

    setIsFlipping(true)
    try {
      const newFacingMode = facingMode === 'user' ? 'environment' : 'user'
      await localParticipant.setCameraEnabled(false)
      await localParticipant.setCameraEnabled(true, { facingMode: newFacingMode })
      setFacingMode(newFacingMode)
    } catch {
      try {
        await localParticipant.setCameraEnabled(true)
      } catch {
        // Silent fail
      }
    } finally {
      setIsFlipping(false)
    }
  }, [localParticipant, facingMode, isFlipping])

  return (
    <Button
      size="icon"
      variant="secondary"
      className="rounded-full h-14 w-14 bg-white/20 hover:bg-white/30 text-white"
      onClick={flipCamera}
      disabled={isFlipping || !isCameraEnabled}
      aria-label={t('flipCamera')}
    >
      <FlipHorizontal className="h-6 w-6" />
    </Button>
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

function EndCallButton({ onEndCall }: { onEndCall?: () => void }) {
  const t = useTranslations('call')
  return (
    <Button
      variant="destructive"
      size="icon"
      className="rounded-full h-14 w-14"
      onClick={onEndCall}
      aria-label={t('endCall')}
    >
      <PhoneOff className="h-6 w-6" />
    </Button>
  )
}

function VideoCallControls({ onEndCall }: { onEndCall?: () => void }) {
  const { isCameraEnabled } = useLocalParticipant()

  return (
    <div className="flex items-center justify-center gap-6 p-6 bg-black/80 shrink-0">
      <AudioControlButton />
      <CameraToggleButton />
      <FlipCameraButton isCameraEnabled={isCameraEnabled} />
      <EndCallButton onEndCall={onEndCall} />
    </div>
  )
}

export function LiveKitRoomView({
  token,
  serverUrl,
  callType,
  onDisconnected,
  onEndCall,
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
          <VideoCallControls onEndCall={onEndCall} />
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
            <ActiveSpeakerPulse />
            <p className="text-lg font-medium">{t('audioCall')}</p>
          </div>
          <div className="flex items-center justify-center gap-6 p-6 bg-black/80 shrink-0">
            <AudioControlButton />
            <EndCallButton onEndCall={onEndCall} />
          </div>
        </div>
      )}
    </LiveKitRoom>
  )
}
