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
    <div className={cn('flex gap-3 py-2', isOwn && 'flex-row-reverse')}>
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={message.users.avatar_url} alt={message.users.username} />
        <AvatarFallback>{message.users.username[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className={cn('flex flex-col gap-1 max-w-xs', isOwn && 'items-end')}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{message.users.username}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
          </span>
        </div>

        <div
          className={cn(
            'rounded-lg px-3 py-2 text-sm break-words',
            isOwn
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {message.content}
        </div>

        {/* Reactions */}
        {Object.entries(reactionGroups).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(reactionGroups).map(([emoji, userIds]) => (
              <button
                key={emoji}
                onClick={() => handleEmoji(emoji)}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs hover:bg-muted/80 transition-colors"
                title={`Reacted by: ${userIds.length} user${userIds.length > 1 ? 's' : ''}`}
              >
                {emoji} <span className="text-xs">{userIds.length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                title="React"
              >
                <SmilePlus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isOwn ? 'end' : 'start'}>
              {EMOJI_REACTIONS.map((emoji) => (
                <DropdownMenuItem key={emoji} onClick={() => handleEmoji(emoji)}>
                  {emoji}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {onReply && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => onReply(message.id)}
              title="Reply"
            >
              ↩️
            </Button>
          )}

          {isOwn && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleDelete}
              disabled={isDeleting}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

          {isOwn && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDelete} disabled={isDeleting}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {replyCount > 0 && (
          <div className="text-xs text-primary mt-1 cursor-pointer hover:underline">
            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </div>
        )}
      </div>
    </div>
  )
}
