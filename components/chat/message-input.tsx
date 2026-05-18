'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Send, Loader2, Smile, X, Paperclip, Image as ImageIcon, Film } from 'lucide-react'
import { validateMediaFile, compressImage, formatFileSize, getMediaType, createObjectURL, revokeObjectURL } from '@/lib/media-utils'

const EMOJI_CATEGORIES = [
  {
    key: 'categorySmileys',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🫡'],
  },
  {
    key: 'categoryGestures',
    emojis: ['👍', '👎', '👏', '🙌', '🤝', '🫶', '❤️', '🔥', '💯', '✨', '🎉', '🎊', '💪', '🙏', '👀', '🫠', '😎', '🤯', '😱', '😢', '😭', '😤', '🤬', '💀', '👻', '🤖', '👽', '💩', '🫣', '🥳'],
  },
  {
    key: 'categoryObjects',
    emojis: ['☕', '🍕', '🍔', '🎮', '🎵', '🎸', '📱', '💻', '🚀', '⭐', '🌟', '💡', '📚', '✅', '❌', '⚡', '💎', '🏆', '🎯', '🔔', '💬', '📌', '🔗', '🛠️', '🧠', '💤', '🫡', '🤙', '✌️', '🤞'],
  },
]

interface ReplyingTo {
  id: string
  content: string
  username: string
}

interface MediaAttachment {
  file: File
  previewUrl: string
  mediaType: 'image' | 'video'
  originalSize: number
  compressedSize?: number
  isCompressing: boolean
  compressionProgress: number
}

interface MessageInputProps {
  onSend: (content: string) => Promise<void>
  onSendMedia?: (file: File, mediaType: 'image' | 'video', caption?: string) => Promise<void>
  onTyping?: (isTyping: boolean) => Promise<void>
  disabled?: boolean
  placeholder?: string
  replyingTo?: ReplyingTo | null
  onCancelReply?: () => void
}

export function MessageInput({
  onSend,
  onSendMedia,
  onTyping,
  disabled = false,
  placeholder,
  replyingTo,
  onCancelReply,
}: MessageInputProps) {
  const t = useTranslations('messageInput')
  const [content, setContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [mediaAttachment, setMediaAttachment] = useState<MediaAttachment | null>(null)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup preview URL on unmount or when attachment changes
  useEffect(() => {
    return () => {
      if (mediaAttachment?.previewUrl) {
        revokeObjectURL(mediaAttachment.previewUrl)
      }
    }
  }, [mediaAttachment?.previewUrl])

  // Focus textarea when replying
  useEffect(() => {
    if (replyingTo) {
      textareaRef.current?.focus()
    }
  }, [replyingTo])

  const handleInput = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setContent(value)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }

    if (onTyping && !isTyping && value.length > 0) {
      setIsTyping(true)
      await onTyping(true)
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(async () => {
      if (onTyping && isTyping) {
        setIsTyping(false)
        await onTyping(false)
      }
    }, 3000)
  }

  const handleInsertEmoji = (emoji: string) => {
    setContent((prev) => prev + emoji)
    setEmojiOpen(false)
    textareaRef.current?.focus()
  }

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input so same file can be selected again
    e.target.value = ''

    setMediaError(null)

    const validation = validateMediaFile(file)
    if (!validation.valid) {
      setMediaError(validation.error || t('invalidFile'))
      return
    }

    const mediaType = validation.mediaType!
    const previewUrl = createObjectURL(file)

    const attachment: MediaAttachment = {
      file,
      previewUrl,
      mediaType,
      originalSize: file.size,
      isCompressing: false,
      compressionProgress: 0,
    }

    // Compress images client-side
    if (mediaType === 'image') {
      attachment.isCompressing = true
      setMediaAttachment({ ...attachment })

      const compressed = await compressImage(file, (progress) => {
        setMediaAttachment((prev) => prev ? { ...prev, compressionProgress: progress } : null)
      })

      // Update with compressed file
      if (mediaAttachment?.previewUrl) {
        revokeObjectURL(mediaAttachment.previewUrl)
      }
      const newPreviewUrl = createObjectURL(compressed)

      setMediaAttachment({
        file: compressed,
        previewUrl: newPreviewUrl,
        mediaType,
        originalSize: file.size,
        compressedSize: compressed.size,
        isCompressing: false,
        compressionProgress: 100,
      })
    } else {
      setMediaAttachment(attachment)
    }
  }, [mediaAttachment?.previewUrl])

  const handleRemoveAttachment = useCallback(() => {
    if (mediaAttachment?.previewUrl) {
      revokeObjectURL(mediaAttachment.previewUrl)
    }
    setMediaAttachment(null)
    setMediaError(null)
  }, [mediaAttachment?.previewUrl])

  const handleSend = async () => {
    const trimmed = content.trim()
    const hasMedia = mediaAttachment && !mediaAttachment.isCompressing
    if ((!trimmed && !hasMedia) || isSending || disabled) return

    try {
      setIsSending(true)

      if (hasMedia && onSendMedia) {
        await onSendMedia(
          mediaAttachment.file,
          mediaAttachment.mediaType,
          trimmed || undefined
        )
        handleRemoveAttachment()
      } else if (trimmed) {
        await onSend(trimmed)
      }

      setContent('')
      setIsTyping(false)
      if (onTyping) {
        await onTyping(false)
      }
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch {
      // Keep content so user can retry
    } finally {
      setIsSending(false)
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape' && replyingTo && onCancelReply) {
      onCancelReply()
    }
  }

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  const isDisabled = disabled || isSending

  return (
    <div className="flex flex-col gap-0">
      {/* Reply banner */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-3 py-2 bg-accent/50 rounded-t-lg border border-b-0 border-border/50">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary">
              {t('replyingTo', { name: replyingTo.username })}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {replyingTo.content}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground"
            onClick={onCancelReply}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Media error */}
      {mediaError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive text-xs rounded-t-lg border border-b-0 border-destructive/20">
          <span className="flex-1">{mediaError}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-destructive"
            onClick={() => setMediaError(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Media preview */}
      {mediaAttachment && (
        <div className="relative border border-b-0 border-border/50 rounded-t-lg bg-accent/30 p-3">
          <div className="flex items-start gap-3">
            {/* Thumbnail */}
            <div className="relative flex-shrink-0 rounded-lg overflow-hidden bg-black/10 w-20 h-20">
              {mediaAttachment.mediaType === 'image' ? (
                <img
                  src={mediaAttachment.previewUrl}
                  alt={t('previewAlt')}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-accent">
                  <Film className="h-8 w-8 text-muted-foreground" />
                </div>
              )}

              {/* Compression overlay */}
              {mediaAttachment.isCompressing && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="h-5 w-5 animate-spin text-white mx-auto" />
                    <span className="text-[10px] text-white mt-1 block">
                      {Math.round(mediaAttachment.compressionProgress)}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{mediaAttachment.file.name}</p>
              <div className="flex items-center gap-1.5 mt-1">
                {mediaAttachment.mediaType === 'image' ? (
                  <ImageIcon className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <Film className="h-3 w-3 text-muted-foreground" />
                )}
                <span className="text-[11px] text-muted-foreground">
                  {mediaAttachment.compressedSize
                    ? `${formatFileSize(mediaAttachment.originalSize)} -> ${formatFileSize(mediaAttachment.compressedSize)}`
                    : formatFileSize(mediaAttachment.originalSize)
                  }
                </span>
              </div>
              {mediaAttachment.isCompressing && (
                <div className="mt-2 h-1 bg-accent rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${mediaAttachment.compressionProgress}%` }}
                  />
                </div>
              )}
            </div>

            {/* Remove button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground"
              onClick={handleRemoveAttachment}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2 items-end">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Attachment button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="flex-shrink-0 text-muted-foreground hover:text-foreground"
          disabled={isDisabled || mediaAttachment?.isCompressing}
          onClick={() => fileInputRef.current?.click()}
          title={t('attachTitle')}
        >
          <Paperclip className="h-5 w-5" />
          <span className="sr-only">{t('attachSr')}</span>
        </Button>

        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={replyingTo ? t('replyPlaceholder', { name: replyingTo.username }) : placeholder}
          disabled={isDisabled}
          className="min-h-10 max-h-30 resize-none"
          rows={1}
        />
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="flex-shrink-0 text-muted-foreground hover:text-foreground"
              disabled={isDisabled}
              title={t('emojiTitle')}
            >
              <Smile className="h-5 w-5" />
              <span className="sr-only">{t('emojiSr')}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="end"
            className="w-80 p-3"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {EMOJI_CATEGORIES.map((category) => (
                <div key={category.key}>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    {t(category.key)}
                  </p>
                  <div className="grid grid-cols-10 gap-0.5">
                    {category.emojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleInsertEmoji(emoji)}
                        className="h-8 w-8 flex items-center justify-center rounded-md text-lg hover:bg-accent transition-colors cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Button
          onClick={handleSend}
          disabled={(!content.trim() && !mediaAttachment) || isDisabled || mediaAttachment?.isCompressing}
          size="icon"
          className="flex-shrink-0"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span className="sr-only">{t('sendSr')}</span>
        </Button>
      </div>
    </div>
  )
}
