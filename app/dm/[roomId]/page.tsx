'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChatWindow } from '@/components/chat/chat-window'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useNotifications } from '@/contexts/notification-context'
import { ChatLayout } from '@/components/layout/chat-layout'

export default function DMChatPage() {
  const router = useRouter()
  const params = useParams()
  const roomId = params.roomId as string
  const [user, setUser] = useState<any>(null)
  const [room, setRoom] = useState<any>(null)
  const [otherUser, setOtherUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const { markRoomAsSeen } = useNotifications()

  useEffect(() => {
    // Mark room as seen when entering
    markRoomAsSeen(roomId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

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

        // Fetch room details
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

        // Check if user is a participant
        if (
          roomData.participant_1_id !== authUser.id &&
          roomData.participant_2_id !== authUser.id
        ) {
          setError('You do not have access to this room')
          return
        }

        setRoom(roomData)

        // Determine other user
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

  if (loading) {
    return (
      <ChatLayout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
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
      <div className="flex flex-col h-full bg-background">
        <header className="border-b bg-card">
          <div className="px-4 py-3 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden mr-1"
              onClick={() => router.push('/dashboard')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar className="h-10 w-10 border border-border">
              <AvatarImage src={otherUser.avatar_url} alt={otherUser.username} />
              <AvatarFallback>{otherUser.username[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-base font-semibold leading-none">{otherUser.username}</h1>
              <p className="text-xs text-muted-foreground mt-1">Direct Message</p>
            </div>
          </div>
        </header>

        <section className="flex-1 min-h-0">
          <ChatWindow
            roomId={roomId}
            roomType="dm"
            currentUserId={user.id}
          />
        </section>
      </div>
    </ChatLayout>
  )
}
