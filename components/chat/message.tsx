'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useLocale, useTranslations } from 'next-intl'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Trash2, SmilePlus, Reply, MoreVertical, Pin, PinOff, Loader2, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { enUS, vi } from 'date-fns/locale'
import { useState, useCallback, useRef, useEffect } from 'react'

export interface MessageData {
  id: string
  content: string
  user_id: string
  created_at: string
  users: {
    username: string
    avatar_url?: string
  }
  reactions?: Array<{
    emoji: string
    user_id: string
  }>
  replies?: Array<{
    id: string
    reply_to_message_id?: string
  }>
  // For inline reply display
  reply_to?: {
    id: string
    content: string
    user_id: string
    users: {
      username: string
    }
  } | null
  // Pin state (managed client-side)
  is_pinned?: boolean
  // Media attachment
  media_url?: string
  media_type?: 'image' | 'video'
  // Read receipts (other users who have read this message)
  reads?: Array<{
    user_id: string
    read_at: string
    users: { username: string; avatar_url: string | null } | null
  }>
  // Offline-first message status
  status?: 'pending' | 'sent' | 'failed' | 'delivered'
  // Client-generated UUID for idempotency
  client_message_id?: string
}

interface MessageProps {
  message: MessageData
  isOwn: boolean
  currentUserId?: string
  onDelete?: (messageId: string) => Promise<void>
  onReact?: (messageId: string, emoji: string) => Promise<void>
  onReply?: (message: MessageData) => void
  onPin?: (message: MessageData) => void
  onUnpin?: (messageId: string) => void
  onRetry?: (clientMessageId: string) => void
  /** User IDs whose receipts to render under this message (computed by parent for dedupe) */
  readerIdsToRender?: string[]
  /** Theme color for own messages (Messenger-style) */
  themeColor?: string
}

const EMOJI_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

/** Floating emoji that flies up and fades out */
function FloatingEmoji({ emoji, onDone }: { emoji: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 900)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <span
      className="pointer-events-none absolute text-4xl"
      style={{
        animation: 'emoji-float-up 0.9s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
        left: '50%',
        bottom: '100%',
        transform: 'translateX(-50%)',
        zIndex: 50,
      }}
    >
      {emoji}
    </span>
  )
}

export function Message({
  message,
  isOwn,
  currentUserId,
  onDelete,
  onReact,
  onReply,
  onPin,
  onUnpin,
  onRetry,
  readerIdsToRender,
  themeColor = '#0A7CFF',
}: MessageProps) {
  const t = useTranslations('message')
  const locale = useLocale()
  const timeLocale = locale === 'vi' ? vi : enUS
  const [isDeleting, setIsDeleting] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [animatingEmoji, setAnimatingEmoji] = useState<string | null>(null)
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; emoji: string }[]>([])
  const [showImageDialog, setShowImageDialog] = useState(false)
  const floatIdRef = useRef(0)

  const handleDelete = async () => {
    if (!onDelete) return
    try {
      setIsDeleting(true)
      await onDelete(message.id)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleEmoji = useCallback(async (emoji: string) => {
    if (!onReact) return

    // Trigger bounce animation on the reaction badge
    setAnimatingEmoji(emoji)
    setTimeout(() => setAnimatingEmoji(null), 600)

    // Spawn a floating emoji
    const id = ++floatIdRef.current
    setFloatingEmojis((prev) => [...prev, { id, emoji }])

    try {
      await onReact(message.id, emoji)
      setShowEmojiPicker(false)
    } catch (error) {
      console.error('Error adding reaction:', error)
    }
  }, [onReact, message.id])

  const removeFloating = useCallback((id: number) => {
    setFloatingEmojis((prev) => prev.filter((f) => f.id !== id))
  }, [])

  // Group reactions by emoji
  const reactionGroups = (message.reactions || []).reduce(
    (acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = []
      }
      acc[reaction.emoji].push(reaction.user_id)
      return acc
    },
    {} as Record<string, string[]>
  )

  // Determine reply-to display text
  const replyTo = message.reply_to
  let replyLabel = ''
  if (replyTo) {
    const repliedToSelf = replyTo.user_id === message.user_id
    const repliedToOwn = replyTo.user_id === currentUserId
    if (repliedToSelf) {
      replyLabel = isOwn
        ? t('replySelf')
        : t('replySelfOther', { name: message.users.username })
    } else if (isOwn) {
      replyLabel = t('replyYouTo', { name: replyTo.users.username })
    } else if (repliedToOwn) {
      replyLabel = t('replyToYou', { name: message.users.username })
    } else {
      replyLabel = t('replyToOther', {
        name: message.users.username,
        target: replyTo.users.username,
      })
    }
  }

  return (
    <div className={cn('group flex gap-3 py-1', isOwn && 'flex-row-reverse')}>
      {!isOwn && (
        <Avatar className="h-8 w-8 flex-shrink-0 mt-auto mb-1">
          <AvatarImage src={message.users.avatar_url} alt={message.users.username} />
          <AvatarFallback>{message.users.username[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
      )}

      <div className={cn('flex flex-col gap-1 max-w-[75%]', isOwn && 'items-end')}>
        {!isOwn && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-medium text-muted-foreground">{message.users.username}</span>
            <span className="text-[10px] text-muted-foreground/70">
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: timeLocale })}
            </span>
          </div>
        )}

        {/* Reply reference */}
        {replyTo && (
          <div className={cn(
            "flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground",
            isOwn ? "justify-end" : "justify-start"
          )}>
            <Reply className="h-3 w-3 scale-x-[-1]" />
            <span>{replyLabel}</span>
          </div>
        )}

        {replyTo && (
          <div className={cn(
            "rounded-lg px-3 py-1.5 text-xs max-w-full border-l-2 border-primary/40",
            isOwn
              ? "bg-primary/10 text-primary-foreground/70"
              : "bg-accent/30 text-muted-foreground"
          )}>
            <p className="truncate">{replyTo.content}</p>
          </div>
        )}

        {/* Pinned label */}
        {message.is_pinned && (
          <div className={cn(
            "flex items-center gap-1 px-1 text-[11px]",
            isOwn ? "justify-end" : "justify-start"
          )}>
            <Pin className="h-3 w-3 text-amber-500" />
            <span className="text-amber-500 font-medium">{t('pinned')}</span>
          </div>
        )}

        <div className={cn("flex items-end gap-2", isOwn && "flex-row-reverse")}>
          <div
            className={cn(
              'text-[15px] break-words shadow-sm relative',
              message.media_url ? 'rounded-2xl overflow-hidden' : 'px-4 py-2.5',
              isOwn
                ? 'rounded-2xl rounded-tr-sm'
                : 'bg-accent/50 text-foreground rounded-2xl rounded-tl-sm',
              message.is_pinned && 'ring-1 ring-amber-500/30'
            )}
            style={isOwn ? {
              backgroundColor: themeColor,
              color: '#ffffff',
            } : undefined}
          >
            {/* Media content */}
            {message.media_url && message.media_type === 'image' && (
              <>
                <img
                  src={message.media_url}
                  alt={t('imageAlt')}
                  className="max-w-[300px] max-h-[300px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setShowImageDialog(true)}
                  loading="lazy"
                />
                <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
                  <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/90 border-none">
                    <DialogTitle className="sr-only">{t('imagePreview')}</DialogTitle>
                    <img
                      src={message.media_url}
                      alt={t('imageFull')}
                      className="w-full h-full object-contain"
                    />
                  </DialogContent>
                </Dialog>
              </>
            )}

            {message.media_url && message.media_type === 'video' && (
              <video
                src={message.media_url}
                controls
                preload="metadata"
                className="max-w-[300px] max-h-[300px] rounded-sm"
              />
            )}

            {/* Text content (caption or standalone message) */}
            {message.content && (
              <p className={cn(message.media_url && 'px-4 py-2')}>{message.content}</p>
            )}

            {/* Floating emojis anchored to the message bubble */}
            {floatingEmojis.map((f) => (
              <FloatingEmoji key={f.id} emoji={f.emoji} onDone={() => removeFloating(f.id)} />
            ))}
          </div>

          {/* Actions */}
          <div className={cn("flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0", isOwn ? "flex-row-reverse" : "flex-row")}>
            {/* Reply button */}
            {onReply && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full bg-background/50 hover:bg-background shadow-sm border border-border/50 text-muted-foreground"
                onClick={() => onReply(message)}
                title={t('replyAction')}
              >
                <Reply className="h-3.5 w-3.5" />
              </Button>
            )}

            <DropdownMenu open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-background/50 hover:bg-background shadow-sm border border-border/50 text-muted-foreground" title={t('reactAction')}>
                  <SmilePlus className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isOwn ? 'end' : 'start'} className="flex flex-row p-1 min-w-0">
                {EMOJI_REACTIONS.map((emoji) => (
                  <DropdownMenuItem key={emoji} onClick={() => handleEmoji(emoji)} className="px-2 py-1 cursor-pointer text-lg hover:bg-accent rounded-md">
                    {emoji}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* More menu (Pin / Delete) */}
            <DropdownMenu open={showMoreMenu} onOpenChange={setShowMoreMenu}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full bg-background/50 hover:bg-background shadow-sm border border-border/50 text-muted-foreground"
                  title={t('moreAction')}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isOwn ? 'end' : 'start'} className="min-w-36">
                {message.is_pinned ? (
                  <DropdownMenuItem
                    onClick={() => { onUnpin?.(message.id); setShowMoreMenu(false) }}
                    className="gap-2 cursor-pointer"
                  >
                    <PinOff className="h-4 w-4" />
                    <span>{t('unpinAction')}</span>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => { onPin?.(message); setShowMoreMenu(false) }}
                    className="gap-2 cursor-pointer"
                  >
                    <Pin className="h-4 w-4" />
                    <span>{t('pinAction')}</span>
                  </DropdownMenuItem>
                )}
                {isOwn && onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => { handleDelete(); setShowMoreMenu(false) }}
                      disabled={isDeleting}
                      className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>{t('deleteAction')}</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Reactions */}
        {Object.entries(reactionGroups).length > 0 && (
          <div className={cn("flex flex-wrap gap-1 mt-0.5", isOwn ? "justify-end" : "justify-start")}>
            {Object.entries(reactionGroups).map(([emoji, userIds]) => (
              <button
                key={emoji}
                onClick={() => handleEmoji(emoji)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full bg-background border shadow-sm px-2 py-0.5 text-xs hover:bg-accent transition-colors",
                  animatingEmoji === emoji && "animate-reaction-pop"
                )}
                title={t('reactionTitle', { count: userIds.length })}
              >
                <span className={cn(
                  "inline-block transition-transform",
                  animatingEmoji === emoji && "animate-emoji-bounce"
                )}>{emoji}</span>
                <span className="text-[10px] text-muted-foreground font-medium">{userIds.length}</span>
              </button>
            ))}
          </div>
        )}

        {isOwn && (
          <div className="flex items-center gap-2 px-1 mt-0.5">
            <span className="text-[10px] text-muted-foreground/70">
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: timeLocale })}
            </span>
            {/* Message status indicator */}
            {message.status === 'pending' && (
              <span className="text-[10px] text-amber-500 animate-pulse flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Sending...
              </span>
            )}
            {message.status === 'failed' && (
              <button
                onClick={() => message.client_message_id && onRetry?.(message.client_message_id)}
                className="text-[10px] text-destructive flex items-center gap-1 hover:underline cursor-pointer"
              >
                <X className="h-3 w-3" />
                Failed - Retry
              </button>
            )}
            {message.status === 'sent' && (
              <span className="text-[10px] text-green-500">✓</span>
            )}
          </div>
        )}

        {/* Read receipts (Messenger-style avatar stack) */}
        {isOwn && readerIdsToRender && readerIdsToRender.length > 0 && (
          <ReadReceiptStack
            reads={(message.reads || []).filter((r) => readerIdsToRender.includes(r.user_id))}
          />
        )}
      </div>
    </div>
  )
}

function ReadReceiptStack({
  reads,
}: {
  reads: Array<{
    user_id: string
    read_at: string
    users: { username: string; avatar_url: string | null } | null
  }>
}) {
  if (!reads || reads.length === 0) return null
  const visible = reads.slice(0, 3)
  const overflow = reads.length - visible.length
  const tooltip = reads
    .map((r) => r.users?.username || '')
    .filter(Boolean)
    .join(', ')

  return (
    <div className="flex justify-end items-center gap-0.5 px-1 mt-0.5" title={tooltip}>
      {visible.map((r) => (
        <Avatar key={r.user_id} className="h-4 w-4 border border-background">
          <AvatarImage src={r.users?.avatar_url || undefined} alt={r.users?.username || ''} />
          <AvatarFallback className="text-[8px]">
            {(r.users?.username || '?')[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <span className="text-[9px] text-muted-foreground ml-0.5">+{overflow}</span>
      )}
    </div>
  )
}
