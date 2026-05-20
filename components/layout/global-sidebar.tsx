'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { logOut } from '@/app/auth/actions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Loader2, LogOut, MessageSquarePlus, Settings } from 'lucide-react'
import { UserSearch } from '@/components/home/user-search'
import { CreateGroupModal } from '@/components/home/create-group-modal'
import { RoomCard } from '@/components/home/room-card'
import { toast } from 'sonner'
import { useNotifications } from '@/contexts/notification-context'
import { ThemeToggle } from '@/components/theme-toggle'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AvatarEditModal } from '@/components/profile/avatar-edit-modal'

export function GlobalSidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('dashboard')
  const tSidebar = useTranslations('sidebar')
  const tToasts = useTranslations('toasts')
  const locale = useLocale()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<{ id: string; username: string; avatar_url: string | null } | null>(null)
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)
  const [creatingDm, setCreatingDm] = useState(false)
  const { rooms, unseenRoomIds, refreshRooms } = useNotifications()

  const switchLocale = (nextLocale: string) => {
    if (nextLocale === locale) return
    const segments = pathname.split('/')
    if (segments[1] === 'en' || segments[1] === 'vi') {
      segments[1] = nextLocale
    } else {
      segments.splice(1, 0, nextLocale)
    }
    router.push(segments.join('/'))
  }

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push(`/${locale}/auth/login`)
        return
      }

      setUser(user)

      try {
        const res = await fetch('/api/users/me')
        if (res.ok) {
          const data = await res.json()
          setProfile(data)
        }
      } catch {
        // ignore
      }
    }
    checkAuth()
  }, [router])

  const handleAvatarSaved = (newUrl: string) => {
    setProfile((p) => (p ? { ...p, avatar_url: newUrl } : p))
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
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to start conversation')
      }

      const data = await response.json()
      const room = data?.room
      if (!room?.id) {
        throw new Error('Invalid room response')
      }
      toast.success(tToasts('startConversation', { name: username }))
      await refreshRooms()
      router.push(`/${locale}/dm/${room.id}`)
    } catch (error) {
      console.error('Error starting DM:', error)
      toast.error(tToasts('startConversationFailed'))
    } finally {
      setCreatingDm(false)
    }
  }

  const dmRooms = rooms.filter((r) => r.type === 'dm') as any

  return (
    <div className="flex flex-col h-full bg-card/50">
      {/* Sidebar Header */}
      <div className="p-4 border-b flex items-center justify-between gap-2 bg-card">
        <button
          type="button"
          onClick={() => setAvatarModalOpen(true)}
          className="group relative flex-shrink-0"
          aria-label={t('editAvatarAria')}
          title={t('editAvatarAria')}
        >
          <Avatar className="h-10 w-10 border-2 border-border transition-opacity group-hover:opacity-80">
            <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.username || ''} />
            <AvatarFallback>
              {(profile?.username || user?.email || '?')[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white font-medium">
            {t('editShort')}
          </span>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-base truncate">{profile?.username || 'ChaTChiT'}</h2>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem>{t('settings')}</DropdownMenuItem>
              <DropdownMenuItem>{t('pendingMessages')}</DropdownMenuItem>
              <DropdownMenuItem>{t('archivedChats')}</DropdownMenuItem>
              <DropdownMenuItem>{t('restrictedAccount')}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>{t('privacySafety')}</DropdownMenuItem>
              <DropdownMenuItem>{t('help')}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>{t('language')}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup value={locale} onValueChange={switchLocale}>
                    <DropdownMenuRadioItem value="en">{t('english')}</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="vi">{t('vietnamese')}</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
          <form action={logOut}>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-3 border-b space-y-2 bg-card/50">
        <UserSearch 
          onUserSelected={handleStartDM}
          isLoading={creatingDm}
        />
        <CreateGroupModal dmRooms={dmRooms} onGroupCreated={refreshRooms} />
      </div>

      {profile && (
        <AvatarEditModal
          open={avatarModalOpen}
          onOpenChange={setAvatarModalOpen}
          currentAvatarUrl={profile.avatar_url}
          username={profile.username}
          onSaved={handleAvatarSaved}
        />
      )}

      {/* Rooms List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {rooms.length === 0 ? (
            <div className="text-center p-4 mt-8">
              <p className="text-sm text-muted-foreground">{tSidebar('noConversations')}</p>
            </div>
          ) : (
            rooms.map((room) => (
              <RoomCard 
                key={`${room.type}-${room.id}`} 
                room={room} 
                isUnseen={unseenRoomIds.has(room.id)} 
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}