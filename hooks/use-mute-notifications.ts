'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export type MuteDuration = '15m' | '1h' | '8h' | '24h' | 'indefinite'

export interface MuteInfo {
  is_muted: boolean
  muted_until: string | null
  time_remaining: string | null
}

export interface MuteSettings {
  roomId: string
  roomType: 'dm' | 'club'
  duration: MuteDuration
}

export function useMuteNotifications() {
  const [mutes, setMutes] = useState<Record<string, MuteInfo>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get mute status for a room
  const getMuteStatus = useCallback(async (
    roomId: string,
    roomType: 'dm' | 'club'
  ): Promise<MuteInfo> => {
    try {
      const response = await fetch(`/api/mutes/${roomId}?type=${roomType}`)
      if (!response.ok) {
        return { is_muted: false, muted_until: null, time_remaining: null }
      }
      return await response.json()
    } catch {
      return { is_muted: false, muted_until: null, time_remaining: null }
    }
  }, [])

  // Load mute status for a room and cache it
  const loadMuteStatus = useCallback(async (
    roomId: string,
    roomType: 'dm' | 'club'
  ): Promise<MuteInfo> => {
    const key = `${roomType}:${roomId}`
    const cached = mutes[key]
    if (cached) return cached

    const status = await getMuteStatus(roomId, roomType)
    setMutes(prev => ({ ...prev, [key]: status }))
    return status
  }, [getMuteStatus, mutes])

  // Mute a room
  const muteRoom = useCallback(async (
    roomId: string,
    roomType: 'dm' | 'club',
    duration: MuteDuration
  ): Promise<boolean> => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/mutes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId, room_type: roomType, duration }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to mute notifications')
      }
      
      const data = await response.json()
      const key = `${roomType}:${roomId}`
      setMutes(prev => ({
        ...prev,
        [key]: {
          is_muted: true,
          muted_until: data.mute.muted_until,
          time_remaining: duration === 'indefinite' ? 'indefinite' : null,
        }
      }))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Update mute duration
  const updateMuteDuration = useCallback(async (
    roomId: string,
    roomType: 'dm' | 'club',
    duration: MuteDuration
  ): Promise<boolean> => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/mutes/${roomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_type: roomType, duration }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to update mute settings')
      }
      
      const data = await response.json()
      const key = `${roomType}:${roomId}`
      setMutes(prev => ({
        ...prev,
        [key]: {
          is_muted: true,
          muted_until: data.mute.muted_until,
          time_remaining: duration === 'indefinite' ? 'indefinite' : null,
        }
      }))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Unmute a room
  const unmuteRoom = useCallback(async (
    roomId: string,
    roomType: 'dm' | 'club'
  ): Promise<boolean> => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/mutes/${roomId}?type=${roomType}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error('Failed to unmute notifications')
      }
      
      const key = `${roomType}:${roomId}`
      setMutes(prev => {
        const updated = { ...prev }
        delete updated[key]
        return updated
      })
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Check if a room is muted (local check)
  const isMuted = useCallback((roomId: string, roomType: 'dm' | 'club'): boolean => {
    const key = `${roomType}:${roomId}`
    const mute = mutes[key]
    if (!mute) return false
    
    // Check if mute has expired
    if (mute.muted_until && new Date(mute.muted_until) < new Date()) {
      return false
    }
    return mute.is_muted
  }, [mutes])

  // Toggle mute status
  const toggleMute = useCallback(async (
    roomId: string,
    roomType: 'dm' | 'club',
    duration: MuteDuration = 'indefinite'
  ): Promise<boolean> => {
    const isCurrentlyMuted = isMuted(roomId, roomType)
    if (isCurrentlyMuted) {
      return await unmuteRoom(roomId, roomType)
    } else {
      return await muteRoom(roomId, roomType, duration)
    }
  }, [isMuted, unmuteRoom, muteRoom])

  return {
    mutes,
    isLoading,
    error,
    getMuteStatus,
    loadMuteStatus,
    muteRoom,
    updateMuteDuration,
    unmuteRoom,
    isMuted,
    toggleMute,
  }
}

// Hook for realtime mute status of a specific room
export function useRoomMuteStatus(roomId: string | null, roomType: 'dm' | 'club' | null) {
  const [status, setStatus] = useState<MuteInfo>({
    is_muted: false,
    muted_until: null,
    time_remaining: null,
  })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!roomId || !roomType) return

    const fetchStatus = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/mutes/${roomId}?type=${roomType}`)
        if (response.ok) {
          const data = await response.json()
          setStatus(data)
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchStatus()

    // Subscribe to realtime changes
    const supabase = createClient()
    const channel = supabase
      .channel(`mute-status-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_mutes',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          fetchStatus()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, roomType])

  return { status, isLoading }
}
