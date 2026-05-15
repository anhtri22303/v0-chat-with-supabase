'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChatWindow } from '@/components/chat/chat-window'
import { RoomCard } from '@/components/home/room-card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default function DMChatPage() {
  const router = useRouter()
  const params = useParams()
  const roomId = params.roomId as string
  const [user, setUser] = useState<any>(null)
  const [room, setRoom] = useState<any>(null)
  const [otherUser, setOtherUser] = useState<any>(null)
  const [rooms, setRooms] = useState<any[]>([])
  const [roomsLoading, setRoomsLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

        // Load room list for sidebar
        try {
          setRoomsLoading(true)
          const roomsResponse = await fetch('/api/rooms')
          const roomsData = await roomsResponse.json()
          setRooms(roomsData.rooms || [])
        } catch (roomsError) {
          console.error('Error loading rooms list:', roomsError)
          setRooms([])
        } finally {
          setRoomsLoading(false)
        }

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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !room || !user || !otherUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error || 'Failed to load room'}</p>
        <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-8 w-8">
            <AvatarImage src={otherUser.avatar_url} alt={otherUser.username} />
            <AvatarFallback>{otherUser.username[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold">{otherUser.username}</h1>
            <p className="text-sm text-muted-foreground">Direct Message</p>
          </div>
        </div>
      </header>

      <div className="flex-1 w-full max-w-7xl mx-auto">
        <div className="h-full flex">
          <aside className="w-full max-w-[220px] border-r bg-card/40">
            <div className="p-4 border-b">
              <h2 className="text-sm font-semibold text-muted-foreground">Your Rooms</h2>
            </div>
            <div className="p-3 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
              {roomsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : rooms.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No rooms yet
                </p>
              ) : (
                rooms.map((r) => (
                  <RoomCard
                    key={`${r.type}-${r.id}`}
                    room={r}
                    isActive={r.type === 'dm' ? r.id === roomId : false}
                  />
                ))
              )}
            </div>
          </aside>

          <section className="flex-1">
            <ChatWindow
              roomId={roomId}
              roomType="dm"
              currentUserId={user.id}
            />
          </section>
        </div>
      </div>
    </div>
  )
}
