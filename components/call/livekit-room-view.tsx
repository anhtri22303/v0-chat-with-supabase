'use client'

import '@livekit/components-styles'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  ParticipantTile,
  useTracks,
  useRoomContext,
} from '@livekit/components-react'
import { RoomEvent, Track } from 'livekit-client'
import { useEffect, useMemo, useState } from 'react'
import type { CallMediaType } from '@/lib/call-types'

interface LiveKitRoomViewProps {
  token: string
  serverUrl: string
  callType: CallMediaType
  onDisconnected: () => void
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

function LocalTrackSync({ callType }: { callType: CallMediaType }) {
  const room = useRoomContext()

  useEffect(() => {
    if (!room) return
    room.localParticipant.setCameraEnabled(callType === 'video').catch(() => {})
  }, [room, callType])

  return null
}

function VideoStage() {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: true })
  const local = tracks.find((track) => track.participant.isLocal)
  const remotes = tracks.filter((track) => !track.participant.isLocal)
  const primary = remotes[0] || local

  return (
    <div className="relative h-full w-full">
      {primary ? (
        <ParticipantTile
          trackRef={primary}
          className="h-full w-full rounded-none"
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center text-white/60">
          Dang ket noi video...
        </div>
      )}
      {local && remotes.length > 0 && (
        <div className="absolute bottom-4 right-4 h-40 w-28 sm:h-48 sm:w-36 rounded-xl overflow-hidden border border-white/20 shadow-lg">
          <ParticipantTile trackRef={local} className="h-full w-full" />
        </div>
      )}
    </div>
  )
}

export function LiveKitRoomView({
  token,
  serverUrl,
  callType,
  onDisconnected,
}: LiveKitRoomViewProps) {
  if (!serverUrl) {
    return (
      <div className="flex items-center justify-center h-full text-destructive p-4 text-center">
        Thiếu NEXT_PUBLIC_LIVEKIT_URL trong cấu hình môi trường.
      </div>
    )
  }

  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return (
      <div className="flex items-center justify-center h-full text-destructive p-4 text-center">
        Trinh duyet chi cho phep micro/camera trong HTTPS hoac localhost.
      </div>
    )
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect
      audio
      video={callType === 'video'}
      onDisconnected={onDisconnected}
      className="h-full w-full"
      data-lk-theme="default"
    >
      <LocalTrackSync callType={callType} />
      <RoomAudioRenderer />
      {callType === 'video' ? (
        <VideoStage />
      ) : (
        <div className="flex flex-col h-full">
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
            <ActiveSpeakerPulse />
            <p className="text-lg font-medium">Cuộc gọi thoại</p>
          </div>
          <ControlBar controls={{ camera: false, screenShare: false }} />
        </div>
      )}
    </LiveKitRoom>
  )
}
