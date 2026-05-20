'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChatWindow } from '@/components/chat/chat-window'
import { ChatHeader } from '@/components/chat/chat-header'
import { ChatDetailsPanel } from '@/components/chat/chat-details-panel'
import { Button } from '@/components/ui/button'
import { Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useNotifications } from '@/contexts/notification-context'
import { ChatLayout } from '@/components/layout/chat-layout'
import { useIsLargeScreen } from '@/hooks/use-media-query'
import { useCall } from '@/contexts/call-context'
import { useTranslations } from 'next-intl'
import { useThemeColor } from '@/components/chat/theme-picker'
import type { ClubMemberInfo } from '@/components/chat/chat-details-content'

export default function ClubChatPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const t = useTranslations('club')
  const tDm = useTranslations('dm')
  const clubId = params.clubId as string
  const highlightMessageId = searchParams.get('msg')
  const [user, setUser] = useState<any>(null)
  const [club, setClub] = useState<any>(null)
  const [members, setMembers] = useState<ClubMemberInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [themeColor, setThemeColor] = useState('#0A7CFF')
  const isLargeScreen = useIsLargeScreen()

  const { markRoomAsSeen } = useNotifications()
  const { startCall, acceptCall, roomActiveCall, activeCall, refreshRoomActiveCall } =
    useCall()
  const { getThemeForRoom } = useThemeColor()

  useEffect(() => {
    markRoomAsSeen(clubId)
  }, [clubId, markRoomAsSeen])

  useEffect(() => {
    refreshRoomActiveCall('club', clubId)
    const interval = setInterval(() => refreshRoomActiveCall('club', clubId), 8000)
    return () => clearInterval(interval)
  }, [clubId, refreshRoomActiveCall])

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

        const { data: clubData, error: clubError } = await supabase
          .from('clubs')
          .select('*')
          .eq('id', clubId)
          .single()

        if (clubError || !clubData) {
          setError(t('notFound'))
          return
        }

        setClub(clubData)

        // Fetch theme color
        const clubTheme = await getThemeForRoom(clubId, 'club')
        setThemeColor(clubTheme)

        const { data: membersData } = await supabase
          .from('club_members')
          .select(
            `
            id,
            user_id,
            role,
            users:user_id(id, username, avatar_url)
          `
          )
          .eq('club_id', clubId)

        if (membersData) {
          setMembers(membersData as unknown as ClubMemberInfo[])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('loadFailed'))
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [clubId, router])

  const handleInfoClick = useCallback(() => {
    if (isLargeScreen) {
      setDetailsOpen((v) => !v)
    } else {
      router.push(`/clubs/${clubId}/details`)
    }
  }, [isLargeScreen, router, clubId])

  const handleSearchSelect = useCallback(
    (messageId: string) => {
      setDetailsOpen(false)
      router.replace(`/clubs/${clubId}?msg=${messageId}`)
    },
    [router, clubId]
  )

  const clubAvatar = (
    <div className="h-10 w-10 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">
      <Users className="h-5 w-5" />
    </div>
  )

  const showJoinBadge =
    roomActiveCall?.room_id === clubId &&
    roomActiveCall?.room_type === 'club' &&
    ['ringing', 'active'].includes(roomActiveCall.status) &&
    activeCall?.session.id !== roomActiveCall.id

  const clubAvatarLarge = (
    <div className="h-24 w-24 bg-primary/10 text-primary rounded-full flex items-center justify-center">
      <Users className="h-10 w-10" />
    </div>
  )

  if (loading) {
    return (
      <ChatLayout>
        <div className="flex flex-col h-full bg-background">
          <header className="border-b bg-card">
            <div className="px-4 py-3 flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </header>
          <section className="flex-1 min-h-0">
            <ChatWindow roomId={clubId} roomType="club" currentUserId="" />
          </section>
        </div>
      </ChatLayout>
    )
  }

  if (error || !club || !user) {
    return (
      <ChatLayout>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-destructive">{error || t('loadFailed')}</p>
          <Button onClick={() => router.push('/dashboard')}>{tDm('backToDashboard')}</Button>
        </div>
      </ChatLayout>
    )
  }

  return (
    <ChatLayout>
      <div className="flex h-full min-w-0 bg-background">
        <div className="flex flex-col flex-1 min-w-0">
          <ChatHeader
            title={club.name}
            subtitle={
              showJoinBadge
                ? t('activeCall')
                : club.description || 'Club Chat'
            }
            avatarFallback={clubAvatar}
            showBack
            onBack={() => router.push('/dashboard')}
            onInfoClick={handleInfoClick}
            onVoiceCall={() => startCall({ roomType: 'club', roomId: clubId, callType: 'audio' })}
            onVideoCall={() => startCall({ roomType: 'club', roomId: clubId, callType: 'video' })}
            activeCallBadge={showJoinBadge}
            onJoinActiveCall={() => roomActiveCall && acceptCall(roomActiveCall)}
          />
          <section className="flex-1 min-h-0">
            <ChatWindow
              roomId={clubId}
              roomType="club"
              currentUserId={user.id}
              highlightMessageId={highlightMessageId}
              themeColor={themeColor}
            />
          </section>
        </div>
        {detailsOpen && isLargeScreen && (
          <ChatDetailsPanel
            roomType="club"
            roomId={clubId}
            displayName={club.name}
            subtitle={t('memberCount', { count: members.length })}
            description={club.description}
            avatarFallback={clubAvatarLarge}
            members={members}
            memberCount={members.length}
            onSearchSelect={handleSearchSelect}
            onClose={() => setDetailsOpen(false)}
            themeColor={themeColor}
            onThemeChange={setThemeColor}
          />
        )}
      </div>
    </ChatLayout>
  )
}
