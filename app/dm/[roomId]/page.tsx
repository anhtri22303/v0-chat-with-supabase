'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChatWindow } from '@/components/chat/chat-window'
import { ChatHeader } from '@/components/chat/chat-header'
import { ChatDetailsPanel } from '@/components/chat/chat-details-panel'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useNotifications } from '@/contexts/notification-context'
import { ChatLayout } from '@/components/layout/chat-layout'
import { useIsLargeScreen } from '@/hooks/use-media-query'
import { useCall } from '@/contexts/call-context'

export default function DMChatPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const roomId = params.roomId as string
  const highlightMessageId = searchParams.get('msg')
  const [user, setUser] = useState<any>(null)
  const [room, setRoom] = useState<any>(null)
  const [otherUser, setOtherUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const isLargeScreen = useIsLargeScreen()

  const { markRoomAsSeen, rooms } = useNotifications()
  const { startCall } = useCall()

  useEffect(() => {
    markRoomAsSeen(roomId)
  }, [roomId, markRoomAsSeen])

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()

        if (!authUser) {
          router.push('/auth/login')
          return
        }

        setUser(authUser)

        const { data: roomData, error: roomError } = await supabase
          .from('dm_rooms')
          .select(
            `
            id,
            participant_1_id,
            participant_2_id,
            participant1:participant_1_id(id, username, avatar_url),
            participant2:participant_2_id(id, username, avatar_url)
          `
          )
          .eq('id', roomId)
          .single()

        if (roomError || !roomData) {
          setError('Room not found')
          return
        }

        if (
          roomData.participant_1_id !== authUser.id &&
          roomData.participant_2_id !== authUser.id
        ) {
          setError('You do not have access to this room')
          return
        }

        setRoom(roomData)

        const other =
          roomData.participant_1_id === authUser.id
            ? roomData.participant2
            : roomData.participant1
        setOtherUser(other)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load room')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [roomId, router])

  const handleInfoClick = useCallback(() => {
    if (isLargeScreen) {
      setDetailsOpen((v) => !v)
    } else {
      router.push(`/dm/${roomId}/details`)
    }
  }, [isLargeScreen, router, roomId])

  const handleSearchSelect = useCallback(
    (messageId: string) => {
      setDetailsOpen(false)
      router.replace(`/dm/${roomId}?msg=${messageId}`)
    },
    [router, roomId]
  )

  const dmRoomsForGroup = rooms
    .filter((r) => r.type === 'dm' && r.participant)
    .map((r) => ({
      id: r.id,
      name: r.name,
      participant: r.participant!,
    }))

  if (loading) {
    return (
      <ChatLayout>
        <div className="flex flex-col h-full bg-background">
          <header className="border-b bg-card">
            <div className="px-4 py-3 flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </header>
          <section className="flex-1 min-h-0">
            <ChatWindow roomId={roomId} roomType="dm" currentUserId="" />
          </section>
        </div>
      </ChatLayout>
    )
  }

  if (error || !room || !user || !otherUser) {
    return (
      <ChatLayout>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-destructive">{error || 'Failed to load room'}</p>
          <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
        </div>
      </ChatLayout>
    )
  }

  return (
    <ChatLayout>
      <div className="flex h-full min-w-0 bg-background">
        <div className="flex flex-col flex-1 min-w-0">
          <ChatHeader
            title={otherUser.username}
            subtitle="Direct Message"
            avatarUrl={otherUser.avatar_url}
            showBack
            onBack={() => router.push('/dashboard')}
            onInfoClick={handleInfoClick}
            onVoiceCall={() => startCall({ roomType: 'dm', roomId, callType: 'audio' })}
            onVideoCall={() => startCall({ roomType: 'dm', roomId, callType: 'video' })}
          />
          <section className="flex-1 min-h-0">
            <ChatWindow
              roomId={roomId}
              roomType="dm"
              currentUserId={user.id}
              highlightMessageId={highlightMessageId}
            />
          </section>
        </div>
        {detailsOpen && isLargeScreen && (
          <ChatDetailsPanel
            roomType="dm"
            roomId={roomId}
            displayName={otherUser.username}
            subtitle="Direct Message"
            avatarUrl={otherUser.avatar_url}
            otherUserId={otherUser.id}
            otherUsername={otherUser.username}
            dmRoomsForGroup={dmRoomsForGroup}
            onSearchSelect={handleSearchSelect}
            onClose={() => setDetailsOpen(false)}
          />
        )}
      </div>
    </ChatLayout>
  )
}
