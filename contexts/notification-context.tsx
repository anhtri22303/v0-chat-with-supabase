'use client'

import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export interface Room {
  type: 'dm' | 'group'
  id: string
  name: string
  last_message: string
  last_message_time: string
  last_message_sender_id?: string
  last_message_sender_name?: string
  member_count?: number
  description?: string
  participant?: {
    id: string
    username: string
  }
}

interface NotificationContextType {
  rooms: Room[]
  unseenRoomIds: Set<string>
  markRoomAsSeen: (roomId: string) => void
  refreshRooms: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

// Singleton Supabase client for realtime - avoids creating multiple WebSocket connections
let realtimeClient: ReturnType<typeof createClient> | null = null
function getRealtimeClient() {
  if (!realtimeClient) {
    realtimeClient = createClient()
  }
  return realtimeClient
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [unseenRoomIds, setUnseenRoomIds] = useState<Set<string>>(new Set())
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  const lastRoomsRef = useRef<Record<string, string>>({})
  const notifiedMessageTimesRef = useRef<Set<string>>(new Set())
  const currentUserIdRef = useRef<string | null>(null)
  const roomsRef = useRef<Room[]>([])

  // Keep refs in sync
  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  useEffect(() => {
    currentUserIdRef.current = currentUserId
  }, [currentUserId])

  useEffect(() => {
    roomsRef.current = rooms
  }, [rooms])

  // Get current user
  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }
    }
    fetchUser()
  }, [])

  const fetchRooms = useCallback(async () => {
    const userId = currentUserIdRef.current
    if (!userId) return

    try {
      const response = await fetch('/api/rooms')
      if (!response.ok) return

      const data = await response.json()
      const fetchedRooms: Room[] = data.rooms || []

      setRooms(fetchedRooms)

      const currentPathname = pathnameRef.current
      const addedIds: string[] = []

      fetchedRooms.forEach(room => {
        const prevTime = lastRoomsRef.current[room.id]

        // If there's a new message
        if (prevTime && prevTime !== room.last_message_time) {
          const isOwnMessage = room.last_message_sender_id === userId
          const isCurrentRoom = currentPathname === `/dm/${room.id}` || currentPathname === `/clubs/${room.id}`

          if (!isOwnMessage && !isCurrentRoom) {
            addedIds.push(room.id)

            // Show toast if we haven't shown it for this exact message time
            const messageKey = `${room.id}-${room.last_message_time}`
            if (!notifiedMessageTimesRef.current.has(messageKey)) {
              toast.info(`${room.name}`, {
                description: room.last_message,
                duration: 6000,
              })
              notifiedMessageTimesRef.current.add(messageKey)
            }
          }
        }

        // Update the ref
        lastRoomsRef.current[room.id] = room.last_message_time
      })

      if (addedIds.length > 0) {
        setUnseenRoomIds(prev => {
          const newSet = new Set(prev)
          addedIds.forEach(id => newSet.add(id))
          return newSet
        })
      }

    } catch (error) {
      console.error('Error fetching rooms:', error)
    }
  }, [])

  // Handle a realtime new message event - show toast immediately without waiting for room refresh
  const handleRealtimeMessage = useCallback(async (payload: {
    new: { id: string; room_id?: string; club_id?: string; user_id: string; content: string; created_at: string }
  }, type: 'dm' | 'club') => {
    const userId = currentUserIdRef.current
    if (!userId) return

    const msg = payload.new
    // Ignore own messages
    if (msg.user_id === userId) {
      // Still refresh rooms to update sidebar last_message
      fetchRooms()
      return
    }

    const roomId = type === 'dm' ? msg.room_id : msg.club_id
    if (!roomId) return

    const currentPathname = pathnameRef.current
    const isCurrentRoom = currentPathname === `/dm/${roomId}` || currentPathname === `/clubs/${roomId}`

    // Find room name from current rooms list
    const currentRooms = roomsRef.current
    const room = currentRooms.find(r => r.id === roomId)
    const roomName = room?.name || (type === 'dm' ? 'Direct Message' : 'Group Chat')

    // Show toast immediately if not in the room
    if (!isCurrentRoom) {
      const messageKey = `${roomId}-${msg.created_at}`
      if (!notifiedMessageTimesRef.current.has(messageKey)) {
        toast.info(`${roomName}`, {
          description: msg.content.length > 80 ? msg.content.substring(0, 80) + '...' : msg.content,
          duration: 6000,
        })
        notifiedMessageTimesRef.current.add(messageKey)
      }

      // Mark room as unseen
      setUnseenRoomIds(prev => {
        const newSet = new Set(prev)
        newSet.add(roomId)
        return newSet
      })
    }

    // Refresh rooms to update sidebar with latest message
    fetchRooms()
  }, [fetchRooms])

  // Subscribe to Supabase Realtime for instant notifications
  useEffect(() => {
    if (!currentUserId) return

    const supabase = getRealtimeClient()

    // Subscribe to DM messages
    const dmChannel = supabase
      .channel('dm-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dm_messages',
        },
        (payload: any) => {
          console.log('[Realtime] DM message received:', payload.new?.id)
          handleRealtimeMessage(payload, 'dm')
        }
      )
      .subscribe((status: string) => {
        console.log('[Realtime] DM channel status:', status)
      })

    // Subscribe to Club messages
    const clubChannel = supabase
      .channel('club-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'club_messages',
        },
        (payload: any) => {
          console.log('[Realtime] Club message received:', payload.new?.id)
          handleRealtimeMessage(payload, 'club')
        }
      )
      .subscribe((status: string) => {
        console.log('[Realtime] Club channel status:', status)
      })

    return () => {
      supabase.removeChannel(dmChannel)
      supabase.removeChannel(clubChannel)
    }
  }, [currentUserId, handleRealtimeMessage])

  // Polling every 5 seconds to keep sidebar always up-to-date
  // Also serves as fallback if Realtime is not configured
  useEffect(() => {
    if (!currentUserId) return

    // Initial fetch
    fetchRooms()

    const intervalId = setInterval(fetchRooms, 5000)
    return () => clearInterval(intervalId)
  }, [currentUserId, fetchRooms])

  const markRoomAsSeen = useCallback((roomId: string) => {
    setUnseenRoomIds(prev => {
      if (!prev.has(roomId)) return prev // No change needed, return same reference
      const newSet = new Set(prev)
      newSet.delete(roomId)
      return newSet
    })
  }, [])

  const contextValue = useMemo(() => ({
    rooms,
    unseenRoomIds,
    markRoomAsSeen,
    refreshRooms: fetchRooms,
  }), [rooms, unseenRoomIds, markRoomAsSeen, fetchRooms])

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}
