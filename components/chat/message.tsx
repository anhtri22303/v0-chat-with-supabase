'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Trash2, SmilePlus } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'

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
  }>
}

interface MessageProps {
  message: MessageData
  isOwn: boolean
  onDelete?: (messageId: string) => Promise<void>
  onReact?: (messageId: string, emoji: string) => Promise<void>
  onReply?: (messageId: string) => void
}

const EMOJI_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

export function Message({
  message,
  isOwn,
  onDelete,
  onReact,
  onReply,
}: MessageProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const handleDelete = async () => {
    if (!onDelete) return
    try {
      setIsDeleting(true)
      await onDelete(message.id)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleEmoji = async (emoji: string) => {
    if (!onReact) return
    try {
      await onReact(message.id, emoji)
      setShowEmojiPicker(false)
    } catch (error) {
      console.error('Error adding reaction:', error)
    }
  }

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

  const replyCount = (message.replies || []).length

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
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
            </span>
          </div>
        )}

        <div className={cn("flex items-end gap-2", isOwn && "flex-row-reverse")}>
          <div
            className={cn(
              'px-4 py-2.5 text-[15px] break-words shadow-sm relative',
              isOwn
                ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm'
                : 'bg-accent/50 text-foreground rounded-2xl rounded-tl-sm'
            )}
          >
            {message.content}
          </div>

          {/* Actions */}
          <div className={cn("flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0", isOwn ? "flex-row-reverse" : "flex-row")}>
            <DropdownMenu open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full bg-background/50 hover:bg-background shadow-sm border border-border/50 text-muted-foreground" title="React">
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

            {isOwn && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full bg-background/50 hover:bg-background hover:text-destructive shadow-sm border border-border/50 text-muted-foreground"
                onClick={handleDelete}
                disabled={isDeleting}
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Reactions */}
        {Object.entries(reactionGroups).length > 0 && (
          <div className={cn("flex flex-wrap gap-1 mt-0.5", isOwn ? "justify-end" : "justify-start")}>
            {Object.entries(reactionGroups).map(([emoji, userIds]) => (
              <button
                key={emoji}
                onClick={() => handleEmoji(emoji)}
                className="inline-flex items-center gap-1 rounded-full bg-background border shadow-sm px-2 py-0.5 text-xs hover:bg-accent transition-colors"
                title={`Reacted by: ${userIds.length} user${userIds.length > 1 ? 's' : ''}`}
              >
                <span>{emoji}</span> <span className="text-[10px] text-muted-foreground font-medium">{userIds.length}</span>
              </button>
            ))}
          </div>
        )}

        {isOwn && (
          <div className="flex items-center gap-2 px-1 mt-0.5">
            <span className="text-[10px] text-muted-foreground/70">
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
            </span>
          </div>
        )}
        
        {replyCount > 0 && (
          <div className="text-xs text-primary mt-1 cursor-pointer hover:underline">
            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </div>
        )}
      </div>
    </div>
  )
}
