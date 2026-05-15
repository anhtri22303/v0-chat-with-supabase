'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Loader2 } from 'lucide-react'

interface MessageInputProps {
  onSend: (content: string) => Promise<void>
  onTyping?: (isTyping: boolean) => Promise<void>
  disabled?: boolean
  placeholder?: string
}

export function MessageInput({
  onSend,
  onTyping,
  disabled = false,
  placeholder = 'Type a message...',
}: MessageInputProps) {
  const [content, setContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleInput = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setContent(value)

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }

    // Handle typing indicator
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

  const handleSend = async () => {
    const trimmed = content.trim()
    if (!trimmed || isSending || disabled) return

    try {
      setIsSending(true)
      await onSend(trimmed)
      // Only clear input on success
      setContent('')
      setIsTyping(false)
      if (onTyping) {
        await onTyping(false)
      }
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch {
      // Keep the content so user can retry
    } finally {
      setIsSending(false)
      // Re-focus the textarea after sending
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
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
    <div className="flex gap-2 items-end">
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isDisabled}
        className="min-h-10 max-h-30 resize-none"
        rows={1}
      />
      <Button
        onClick={handleSend}
        disabled={!content.trim() || isDisabled}
        size="icon"
        className="flex-shrink-0"
      >
        {isSending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        <span className="sr-only">Send message</span>
      </Button>
    </div>
  )
}
