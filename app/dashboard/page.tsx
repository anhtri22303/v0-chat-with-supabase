'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { logOut } from '@/app/auth/actions'
import { Loader2, LogOut } from 'lucide-react'
import { UserSearch } from '@/components/home/user-search'
import { CreateGroupModal } from '@/components/home/create-group-modal'
import { RoomCard } from '@/components/home/room-card'
import { toast } from 'sonner'

interface Room {
  type: 'dm' | 'group'
  id: string
  name: string
  last_message: string
  last_message_time: string
  member_count?: number
  description?: string
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingDm, setCreatingDm] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      setUser(user)
      fetchRooms()
    }

    checkAuth()
  }, [router])

  const fetchRooms = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/rooms')
      const data = await response.json()
      setRooms(data.rooms || [])
    } catch (error) {
      console.error('Error fetching rooms:', error)
      toast.error('Failed to load chat rooms')
    } finally {
      setLoading(false)
    }
  }

  const handleStartDM = async (otherUserId: string, username: string) => {
    setCreatingDm(true)
    try {
      const response = await fetch('/api/dm/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: otherUserId }),
      })

      if (!response.ok) {
        throw new Error('Failed to start conversation')
      }

      const { room } = await response.json()
      toast.success(`Started conversation with ${username}`)
      await fetchRooms()
      router.push(`/dm/${room.id}`)
    } catch (error) {
      console.error('Error starting DM:', error)
      toast.error('Failed to start conversation')
    } finally {
      setCreatingDm(false)
    }
  }

  const dmRooms = rooms.filter((r) => r.type === 'dm')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">ChaTChiT</h1>
            <p className="text-sm text-muted-foreground">Real-time Chat</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="font-medium text-sm">{user?.email}</p>
            </div>
            <form action={logOut}>
              <Button variant="outline" size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Empty state with action buttons */}
        {rooms.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold mb-2">No chat rooms yet</h2>
            <p className="text-muted-foreground mb-8">
              Start a conversation to begin chatting!
            </p>
            <div className="max-w-sm mx-auto space-y-3">
              <UserSearch 
                onUserSelected={handleStartDM}
                isLoading={creatingDm}
              />
              <CreateGroupModal dmRooms={dmRooms} onGroupCreated={fetchRooms} />
            </div>
          </div>
        ) : (
          <>
            {/* Action buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              <UserSearch 
                onUserSelected={handleStartDM}
                isLoading={creatingDm}
              />
              <CreateGroupModal dmRooms={dmRooms} onGroupCreated={fetchRooms} />
            </div>

            {/* Rooms list */}
            <div>
              <h2 className="text-lg font-semibold mb-4">
                Your Conversations ({rooms.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rooms.map((room) => (
                  <RoomCard key={`${room.type}-${room.id}`} room={room} />
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
