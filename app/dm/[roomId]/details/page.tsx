'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChatDetailsContent } from '@/components/chat/chat-details-content'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ChatLayout } from '@/components/layout/chat-layout'
import { useNotifications } from '@/contexts/notification-context'
import { useTranslations } from 'next-intl'

export default function DMDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const t = useTranslations('dm')
  const tDetails = useTranslations('chatDetails')
  const roomId = params.roomId as string
  const [otherUser, setOtherUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { rooms } = useNotifications()

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()
        if (!authUser) {
          router.push('/auth/login')
          return
        }

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
          setError(t('roomNotFound'))
          return
        }

        const other =
          roomData.participant_1_id === authUser.id
            ? roomData.participant2
            : roomData.participant1
        setOtherUser(other)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('loadFailed'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [roomId, router])

  const handleSearchSelect = useCallback(
    (messageId: string) => {
      router.push(`/dm/${roomId}?msg=${messageId}`)
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
        <div className="flex flex-col h-full">
          <div className="px-4 py-3 border-b">
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <Skeleton className="h-24 w-24 rounded-full mx-auto mt-8" />
        </div>
      </ChatLayout>
    )
  }

  if (error || !otherUser) {
    return (
      <ChatLayout>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-destructive">{error || t('loadFailed')}</p>
        </div>
      </ChatLayout>
    )
  }

  return (
    <ChatLayout>
      <div className="flex flex-col h-full bg-background">
        <header className="border-b bg-card shrink-0">
          <div className="px-2 py-2 flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/dm/${roomId}`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="font-semibold text-sm">{tDetails('accordionInfo')}</span>
          </div>
        </header>
        <ChatDetailsContent
          variant="page"
          roomType="dm"
          roomId={roomId}
          displayName={otherUser.username}
          subtitle={t('directMessage')}
          avatarUrl={otherUser.avatar_url}
          otherUserId={otherUser.id}
          otherUsername={otherUser.username}
          dmRoomsForGroup={dmRoomsForGroup}
          onSearchSelect={handleSearchSelect}
        />
      </div>
    </ChatLayout>
  )
}
