'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { isRoomMuted } from '@/lib/room-preferences'
import type { ActiveCallState, CallMediaType, CallRoomType, CallSession } from '@/lib/call-types'
import { IncomingCallDialog } from '@/components/call/incoming-call-dialog'
import { CallOverlay } from '@/components/call/call-overlay'
import { startRingtone, type RingtoneHandle } from '@/lib/ringtone'

interface StartCallParams {
  roomType: CallRoomType
  roomId: string
  callType: CallMediaType
}

interface CallContextType {
  activeCall: ActiveCallState | null
  incomingCall: CallSession | null
  roomActiveCall: CallSession | null
  startCall: (params: StartCallParams) => Promise<void>
  acceptCall: (session?: CallSession) => Promise<void>
  declineCall: (session?: CallSession) => Promise<void>
  endCall: () => Promise<void>
  switchCallType: (callType?: CallMediaType) => Promise<void>
  refreshRoomActiveCall: (roomType: CallRoomType, roomId: string) => Promise<void>
}

const CallContext = createContext<CallContextType | undefined>(undefined)

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null)
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null)
  const [incomingCallerName, setIncomingCallerName] = useState('')
  const [incomingCallerAvatar, setIncomingCallerAvatar] = useState<string | null>(null)
  const [isJoining, setIsJoining] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const [roomActiveCall, setRoomActiveCall] = useState<CallSession | null>(null)

  const activeCallRef = useRef<ActiveCallState | null>(null)
  const incomingCallRef = useRef<CallSession | null>(null)
  const currentUserIdRef = useRef<string | null>(null)
  const ringbackRef = useRef<RingtoneHandle | null>(null)

  useEffect(() => {
    activeCallRef.current = activeCall
  }, [activeCall])

  useEffect(() => {
    incomingCallRef.current = incomingCall
  }, [incomingCall])

  useEffect(() => {
    currentUserIdRef.current = currentUserId
  }, [currentUserId])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id)
    })
  }, [])

  const fetchCallerInfo = useCallback(async (callerId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('users')
      .select('username, avatar_url')
      .eq('id', callerId)
      .single()
    return {
      name: data?.username || 'Người gọi',
      avatar: data?.avatar_url || null,
    }
  }, [])

  const handleSessionUpdate = useCallback(
    async (session: CallSession, eventType: 'INSERT' | 'UPDATE') => {
      const userId = currentUserIdRef.current
      if (!userId) return

      // Skip if we're in active call for this session
      if (activeCallRef.current?.session.id === session.id) {
        if (session.status === 'ended' || session.status === 'declined') {
          setActiveCall(null)
          toast.info(
            session.status === 'declined' ? 'Cuộc gọi đã bị từ chối' : 'Cuộc gọi đã kết thúc'
          )
          return
        }

        setActiveCall((prev) => (prev ? { ...prev, session } : prev))
      }

      if (['ringing', 'active'].includes(session.status)) {
        setRoomActiveCall(session)
      }

      if (session.status === 'ringing' && session.caller_id !== userId) {
        if (incomingCallRef.current?.id === session.id) return
        const caller = await fetchCallerInfo(session.caller_id)
        setIncomingCall(session)
        setIncomingCallerName(caller.name)
        setIncomingCallerAvatar(caller.avatar)

        if (!isRoomMuted(session.room_id)) {
          toast.info(caller.name, {
            description:
              session.call_type === 'video'
                ? 'Cuộc gọi video đến'
                : 'Cuộc gọi thoại đến',
            duration: 10000,
          })
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(caller.name, {
              body:
                session.call_type === 'video'
                  ? 'Cuộc gọi video đến'
                  : 'Cuộc gọi thoại đến',
            })
          }
        }
      }

      if (session.status === 'declined' && session.caller_id === userId) {
        setActiveCall(null)
        setIncomingCall(null)
        toast.info('Cuộc gọi đã bị từ chối')
      }

      if (session.status === 'ended') {
        if (incomingCallRef.current?.id === session.id) {
          setIncomingCall(null)
        }
        if (activeCallRef.current?.session.id === session.id) {
          setActiveCall(null)
        }
      }

      if (eventType === 'UPDATE' && session.status === 'active') {
        setRoomActiveCall(session)
      }
    },
    [fetchCallerInfo]
  )

  useEffect(() => {
    const current = activeCall
    const userId = currentUserId
    if (!current || !userId) {
      ringbackRef.current?.stop()
      ringbackRef.current = null
      return
    }

    const shouldRing =
      current.session.status === 'ringing' && current.session.caller_id === userId

    if (shouldRing && !ringbackRef.current) {
      ringbackRef.current = startRingtone(0.14)
    }

    if (!shouldRing) {
      ringbackRef.current?.stop()
      ringbackRef.current = null
    }
  }, [activeCall, currentUserId])

  useEffect(() => {
    if (!currentUserId) return

    const supabase = createClient()
    const channel = supabase
      .channel('call-sessions-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'call_sessions' },
        (payload) => {
          handleSessionUpdate(payload.new as CallSession, 'INSERT')
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'call_sessions' },
        (payload) => {
          handleSessionUpdate(payload.new as CallSession, 'UPDATE')
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, handleSessionUpdate])

  const startCall = useCallback(async ({ roomType, roomId, callType }: StartCallParams) => {
    try {
      const res = await fetch('/api/calls/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomType, roomId, callType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start call')

      setActiveCall({
        session: data.session,
        token: data.token,
        serverUrl: data.serverUrl,
      })
      setIncomingCall(null)

      if (roomType === 'dm') {
        toast.info('Đang gọi...')
      } else {
        toast.info('Đã bắt đầu cuộc gọi nhóm')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể bắt đầu cuộc gọi')
    }
  }, [])

  const acceptCall = useCallback(async (session?: CallSession) => {
    const target = session || incomingCall
    if (!target) return

    setIsJoining(true)
    try {
      const res = await fetch('/api/calls/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: target.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to join call')

      setActiveCall({
        session: data.session,
        token: data.token,
        serverUrl: data.serverUrl,
      })
      setIncomingCall(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tham gia cuộc gọi')
    } finally {
      setIsJoining(false)
    }
  }, [incomingCall])

  const declineCall = useCallback(async (session?: CallSession) => {
    const target = session || incomingCall
    if (!target) return

    try {
      await fetch('/api/calls/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: target.id }),
      })
      setIncomingCall(null)
    } catch {
      setIncomingCall(null)
    }
  }, [incomingCall])

  const endCall = useCallback(async () => {
    const call = activeCallRef.current
    if (!call) return

    try {
      await fetch('/api/calls/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: call.session.id }),
      })
    } catch {
      // ignore
    }
    setActiveCall(null)
    setRoomActiveCall(null)
  }, [])

  const switchCallType = useCallback(async (callType?: CallMediaType) => {
    const current = activeCallRef.current
    if (!current) return

    const nextType =
      callType || (current.session.call_type === 'video' ? 'audio' : 'video')

    if (nextType === current.session.call_type) return

    setIsSwitching(true)
    try {
      const res = await fetch('/api/calls/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: current.session.id, callType: nextType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to switch call type')

      setActiveCall((prev) => (prev ? { ...prev, session: data.session } : prev))
      setRoomActiveCall(data.session)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Khong the chuyen loai cuoc goi')
    } finally {
      setIsSwitching(false)
    }
  }, [])

  const refreshRoomActiveCall = useCallback(
    async (roomType: CallRoomType, roomId: string) => {
      try {
        const res = await fetch(
          `/api/calls/active?roomType=${roomType}&roomId=${roomId}`
        )
        if (res.ok) {
          const data = await res.json()
          setRoomActiveCall(data.session || null)
        }
      } catch {
        setRoomActiveCall(null)
      }
    },
    []
  )

  const contextValue = useMemo(
    () => ({
      activeCall,
      incomingCall,
      roomActiveCall,
      startCall,
      acceptCall,
      declineCall,
      endCall,
      switchCallType,
      refreshRoomActiveCall,
    }),
    [
      activeCall,
      incomingCall,
      roomActiveCall,
      startCall,
      acceptCall,
      declineCall,
      endCall,
      switchCallType,
      refreshRoomActiveCall,
    ]
  )

  return (
    <CallContext.Provider value={contextValue}>
      {children}
      <IncomingCallDialog
        session={incomingCall}
        callerName={incomingCallerName}
        callerAvatar={incomingCallerAvatar}
        open={!!incomingCall && !activeCall}
        onAccept={() => acceptCall()}
        onDecline={() => declineCall()}
        isJoining={isJoining}
      />
      {activeCall && (
        <CallOverlay
          activeCall={activeCall}
          onEndCall={endCall}
          onToggleCallType={switchCallType}
          isSwitching={isSwitching}
          onDisconnected={endCall}
        />
      )}
    </CallContext.Provider>
  )
}

export function useCall() {
  const ctx = useContext(CallContext)
  if (!ctx) throw new Error('useCall must be used within CallProvider')
  return ctx
}
