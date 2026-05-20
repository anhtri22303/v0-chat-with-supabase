'use client'

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react'
import { createClient } from '@/lib/supabase/client'

interface PresenceContextType {
  onlineUserIds: Set<string>
  isOnline: (userId: string) => boolean
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined)

const HEARTBEAT_INTERVAL_MS = 60_000

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const currentUserIdRef = useRef<string | null>(null)

  const sendHeartbeat = useCallback(async () => {
    try {
      await fetch('/api/users/heartbeat', { method: 'PATCH' })
    } catch {
      // silently ignore heartbeat failures
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || cancelled) return

      currentUserIdRef.current = user.id

      // Send an immediate heartbeat on connect
      await sendHeartbeat()

      // Subscribe to presence channel
      const channel = supabase.channel('online-users', {
        config: { presence: { key: user.id } },
      })

      channelRef.current = channel

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState<{ user_id: string }>()
          const ids = new Set<string>()
          for (const presences of Object.values(state)) {
            for (const p of presences as any[]) {
              if (p.user_id) ids.add(p.user_id)
            }
          }
          setOnlineUserIds(ids)
        })
        .on('presence', { event: 'join' }, ({ newPresences }: { newPresences: any[] }) => {
          setOnlineUserIds((prev) => {
            const next = new Set(prev)
            for (const p of newPresences) {
              if (p.user_id) next.add(p.user_id)
            }
            return next
          })
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }: { leftPresences: any[] }) => {
          setOnlineUserIds((prev) => {
            const next = new Set(prev)
            for (const p of leftPresences) {
              if (p.user_id) next.delete(p.user_id)
            }
            return next
          })
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ user_id: user.id })
          }
        })

      // Heartbeat every 60 seconds to keep last_seen fresh in DB
      heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)
    }

    init()

    return () => {
      cancelled = true
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      if (channelRef.current) {
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
    }
  }, [sendHeartbeat])

  const isOnline = useCallback(
    (userId: string) => onlineUserIds.has(userId),
    [onlineUserIds]
  )

  const value = useMemo(
    () => ({ onlineUserIds, isOnline }),
    [onlineUserIds, isOnline]
  )

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
}

export function usePresence() {
  const ctx = useContext(PresenceContext)
  if (!ctx) throw new Error('usePresence must be used within a PresenceProvider')
  return ctx
}
