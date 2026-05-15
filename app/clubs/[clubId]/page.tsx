'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChatWindow } from '@/components/chat/chat-window'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2, Users } from 'lucide-react'
import { useNotifications } from '@/contexts/notification-context'
import { ChatLayout } from '@/components/layout/chat-layout'

export default function ClubChatPage() {
  const router = useRouter()
  const params = useParams()
  const clubId = params.clubId as string
  const [user, setUser] = useState<any>(null)
  const [club, setClub] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const { markRoomAsSeen } = useNotifications()

  useEffect(() => {
    markRoomAsSeen(clubId)
  }, [clubId, markRoomAsSeen])

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

        // Fetch club details
        const { data: clubData, error: clubError } = await supabase
          .from('clubs')
          .select('*')
          .eq('id', clubId)
          .single()

        if (clubError || !clubData) {
          setError('Club not found')
          return
        }

        setClub(clubData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load club')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [clubId, router])

  if (loading) {
    return (
      <ChatLayout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </ChatLayout>
    )
  }

  if (error || !club || !user) {
    return (
      <ChatLayout>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-destructive">{error || 'Failed to load club'}</p>
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
            <div className="h-10 w-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold leading-none truncate">{club.name}</h1>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {club.description || 'Club Chat'}
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0">
          <ChatWindow
            roomId={clubId}
            roomType="club"
            currentUserId={user.id}
          />
        </div>
      </div>
    </ChatLayout>
  )
}
