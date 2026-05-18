'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ChatDetailsContent, type ClubMemberInfo } from '@/components/chat/chat-details-content'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ChatLayout } from '@/components/layout/chat-layout'

export default function ClubDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const clubId = params.clubId as string
  const [club, setClub] = useState<any>(null)
  const [members, setMembers] = useState<ClubMemberInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
          setMembers(membersData as ClubMemberInfo[])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [clubId, router])

  const handleSearchSelect = useCallback(
    (messageId: string) => {
      router.push(`/clubs/${clubId}?msg=${messageId}`)
    },
    [router, clubId]
  )

  const clubAvatarLarge = (
    <div className="h-24 w-24 bg-primary/10 text-primary rounded-full flex items-center justify-center">
      <Users className="h-10 w-10" />
    </div>
  )

  if (loading) {
    return (
      <ChatLayout>
        <div className="flex flex-col h-full">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-24 rounded-full mx-auto mt-8" />
        </div>
      </ChatLayout>
    )
  }

  if (error || !club) {
    return (
      <ChatLayout>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-destructive">{error || 'Failed to load'}</p>
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
              onClick={() => router.push(`/clubs/${clubId}`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="font-semibold text-sm">Thông tin đoạn chat</span>
          </div>
        </header>
        <ChatDetailsContent
          variant="page"
          roomType="club"
          roomId={clubId}
          displayName={club.name}
          subtitle={`${members.length} thành viên`}
          description={club.description}
          avatarFallback={clubAvatarLarge}
          members={members}
          memberCount={members.length}
          onSearchSelect={handleSearchSelect}
        />
      </div>
    </ChatLayout>
  )
}
