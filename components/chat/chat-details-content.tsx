'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Bell,
  BellOff,
  ChevronRight,
  FileImage,
  Link2,
  Palette,
  Phone,
  Search,
  Shield,
  Type,
  User,
  Users,
  Video,
  Volume2,
} from 'lucide-react'
import { isRoomMuted, toggleRoomMute } from '@/lib/room-preferences'
import { MediaPreviewGrid } from './media-preview-grid'
import { MediaGallery } from './media-gallery'
import { ChatSearchDialog } from './chat-search-dialog'
import { CreateGroupModal } from '@/components/home/create-group-modal'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useCall } from '@/contexts/call-context'

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi

export interface ClubMemberInfo {
  id: string
  user_id: string
  role?: string
  users: {
    id: string
    username: string
    avatar_url?: string
  }
}

export interface ChatDetailsContentProps {
  roomType: 'dm' | 'club'
  roomId: string
  displayName: string
  subtitle?: string
  avatarUrl?: string | null
  avatarFallback?: React.ReactNode
  variant: 'panel' | 'page'
  otherUserId?: string
  otherUsername?: string
  description?: string
  members?: ClubMemberInfo[]
  memberCount?: number
  dmRoomsForGroup?: Array<{
    id: string
    name: string
    participant: { id: string; username: string }
  }>
  onSearchSelect?: (messageId: string) => void
  onBack?: () => void
  enableCalls?: boolean
}

export function ChatDetailsContent({
  roomType,
  roomId,
  displayName,
  subtitle,
  avatarUrl,
  avatarFallback,
  variant,
  otherUserId,
  otherUsername,
  description,
  members = [],
  memberCount,
  dmRoomsForGroup = [],
  onSearchSelect,
  enableCalls = true,
}: ChatDetailsContentProps) {
  const t = useTranslations('chatDetails')
  const { startCall } = useCall()
  const [muted, setMuted] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [links, setLinks] = useState<string[]>([])
  const [mediaAccordion, setMediaAccordion] = useState<string | undefined>()

  const apiBase = roomType === 'dm' ? `/api/dm/rooms/${roomId}` : `/api/club/${roomId}`

  useEffect(() => {
    setMuted(isRoomMuted(roomId))
  }, [roomId])

  useEffect(() => {
    const loadLinks = async () => {
      try {
        const res = await fetch(`${apiBase}/messages?limit=100`)
        if (!res.ok) return
        const data = await res.json()
        const found = new Set<string>()
        for (const msg of data.messages || []) {
          if (msg.content) {
            const matches = msg.content.match(URL_REGEX)
            matches?.forEach((url: string) => found.add(url))
          }
        }
        setLinks(Array.from(found).slice(0, 20))
      } catch {
        // ignore
      }
    }
    loadLinks()
  }, [apiBase])

  const handleMuteChange = (checked: boolean) => {
    const currentlyMuted = isRoomMuted(roomId)
    if (currentlyMuted !== checked) {
      toggleRoomMute(roomId)
    }
    setMuted(checked)
    toast.success(
      checked
        ? t('muteToastOn', { name: displayName })
        : t('muteToastOff', { name: displayName })
    )
  }

  const handlePlaceholder = (label: string) => {
    toast.info(t('placeholderSoon', { label }))
  }

  const quickActions = [
    ...(enableCalls
      ? [
          {
            icon: Phone,
            label: t('quickVoice'),
            onClick: () =>
              startCall({ roomType, roomId, callType: 'audio' as const }),
          },
          {
            icon: Video,
            label: t('quickVideo'),
            onClick: () =>
              startCall({ roomType, roomId, callType: 'video' as const }),
          },
        ]
      : []),
    {
      icon: Search,
      label: t('quickSearch'),
      onClick: () => setSearchOpen(true),
    },
    {
      icon: Type,
      label: t('quickNickname'),
      onClick: () => handlePlaceholder(t('quickNickname')),
    },
    {
      icon: Palette,
      label: t('quickCustomize'),
      onClick: () => handlePlaceholder(t('quickCustomize')),
    },
    roomType === 'dm'
      ? {
          icon: User,
          label: t('quickProfile'),
          onClick: () => handlePlaceholder(t('quickProfile')),
        }
      : {
          icon: Users,
          label: t('quickMembers'),
          onClick: () => setMediaAccordion('members'),
        },
  ]

  return (
    <div
      className={cn(
        'flex flex-col h-full overflow-y-auto bg-background',
        variant === 'panel' ? 'w-full' : 'min-h-full'
      )}
    >
      <div className="flex flex-col items-center pt-6 pb-4 px-4">
        {avatarFallback ? (
          <div className="mb-3">{avatarFallback}</div>
        ) : (
          <Avatar className="h-24 w-24 border-2 border-border mb-3">
            <AvatarImage src={avatarUrl || undefined} alt={displayName} />
            <AvatarFallback className="text-2xl">
              {displayName[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
        <h2 className="text-xl font-bold text-center">{displayName}</h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1 text-center">{subtitle}</p>
        )}
        {description && variant === 'page' && (
          <p className="text-sm text-muted-foreground mt-2 text-center px-4">
            {description}
          </p>
        )}
      </div>

      {variant === 'page' ? (
        <div className="grid grid-cols-4 gap-2 px-4 pb-4">
          {quickActions.map(({ icon: Icon, label, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className="flex flex-col items-center gap-1.5"
            >
              <span className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-[11px] text-muted-foreground text-center leading-tight">
                {label}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="px-4 pb-4 flex justify-center">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full gap-2"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
            {t('search')}
          </Button>
        </div>
      )}

      {variant === 'page' && (
        <>
          <SectionTitle>{t('sectionInfo')}</SectionTitle>
          <div className="mx-4 mb-4 rounded-xl bg-card border overflow-hidden">
            <MediaPreviewGrid
              roomType={roomType}
              roomId={roomId}
              onViewAll={() => setMediaAccordion('media')}
            />
            <button
              type="button"
              onClick={() => setMediaAccordion('media')}
              className="w-full flex items-center gap-3 px-4 py-3 border-t hover:bg-muted/50 transition-colors"
            >
              <FileImage className="h-5 w-5 text-muted-foreground" />
              <span className="flex-1 text-sm text-left">
                {t('mediaLinksFiles')}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <SectionTitle>{t('sectionActions')}</SectionTitle>
          <div className="mx-4 mb-6 rounded-xl bg-card border divide-y">
            <ActionRow
              icon={muted ? BellOff : Bell}
              label={
                muted
                  ? t('muteOn', { name: displayName })
                  : t('muteOff', { name: displayName })
              }
              trailing={<Switch checked={muted} onCheckedChange={handleMuteChange} />}
            />
            <ActionRow
              icon={Volume2}
              label={t('notificationsSound')}
              onClick={() => handlePlaceholder(t('notificationsSound'))}
              showChevron
            />
            {roomType === 'dm' && otherUserId && (
              <div className="px-4 py-3">
                <CreateGroupModal
                  dmRooms={dmRoomsForGroup}
                  initialMemberIds={[otherUserId]}
                  triggerLabel={t('createGroupWith', { name: otherUsername || displayName })}
                  triggerVariant="ghost"
                  triggerClassName="w-full justify-start h-auto p-0 font-normal text-sm hover:bg-transparent"
                />
              </div>
            )}
          </div>
        </>
      )}

      <Accordion
        type="single"
        collapsible
        value={mediaAccordion}
        onValueChange={setMediaAccordion}
        className="px-4 pb-6"
      >
        {variant === 'panel' && (
          <>
            <AccordionItem value="info">
              <AccordionTrigger>{t('accordionInfo')}</AccordionTrigger>
              <AccordionContent>
                <MediaPreviewGrid
                  roomType={roomType}
                  roomId={roomId}
                  onViewAll={() => setMediaAccordion('media')}
                  className="mb-2"
                />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="customize">
              <AccordionTrigger>{t('accordionCustomize')}</AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground">
                  {t('customizePlaceholder')}
                </p>
              </AccordionContent>
            </AccordionItem>
          </>
        )}

        <AccordionItem value="media">
          <AccordionTrigger>
            {variant === 'panel' ? t('mediaPanel') : t('mediaPage')}
          </AccordionTrigger>
          <AccordionContent>
            <MediaGallery roomType={roomType} roomId={roomId} />
            {links.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Link2 className="h-3.5 w-3.5" />
                  {t('links')}
                </p>
                <ul className="space-y-1">
                  {links.map((url) => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline break-all line-clamp-2"
                      >
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {roomType === 'club' && members.length > 0 && (
          <AccordionItem value="members">
            <AccordionTrigger>
              {t('members', { count: memberCount ?? members.length })}
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={m.users.avatar_url} />
                      <AvatarFallback>
                        {m.users.username[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{m.users.username}</span>
                    {m.role === 'leader' && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {t('admin')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )}

        <AccordionItem value="privacy">
          <AccordionTrigger>{t('privacySupport')}</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <button
                type="button"
                className="flex items-center gap-2 w-full hover:text-foreground"
                onClick={() => handlePlaceholder(t('reportChat'))}
              >
                <Shield className="h-4 w-4" />
                {t('reportChat')}
              </button>
              <button
                type="button"
                className="flex items-center gap-2 w-full hover:text-foreground"
                onClick={() => handlePlaceholder(t('blockUser'))}
              >
                <Shield className="h-4 w-4" />
                {t('blockUser')}
              </button>
            </div>
          </AccordionContent>
        </AccordionItem>

        {variant === 'panel' && (
          <div className="pt-4 border-t mt-2">
            <ActionRow
              icon={muted ? BellOff : Bell}
              label={muted ? t('mutePanelOn') : t('mutePanelOff')}
              trailing={<Switch checked={muted} onCheckedChange={handleMuteChange} />}
            />
            {roomType === 'dm' && otherUserId && (
              <div className="mt-3">
                <CreateGroupModal
                  dmRooms={dmRoomsForGroup}
                  initialMemberIds={[otherUserId]}
                  triggerLabel={t('createGroupWith', { name: otherUsername || displayName })}
                  triggerVariant="outline"
                  triggerClassName="w-full"
                />
              </div>
            )}
          </div>
        )}
      </Accordion>

      <ChatSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        roomType={roomType}
        roomId={roomId}
        onSelectMessage={(id) => onSearchSelect?.(id)}
      />
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 mb-2">
      {children}
    </p>
  )
}

function ActionRow({
  icon: Icon,
  label,
  onClick,
  trailing,
  showChevron,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick?: () => void
  trailing?: React.ReactNode
  showChevron?: boolean
}) {
  const content = (
    <>
      <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
      <span className="flex-1 text-sm text-left">{label}</span>
      {trailing}
      {showChevron && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        {content}
      </button>
    )
  }

  return <div className="flex items-center gap-3 px-4 py-3">{content}</div>
}
