'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Message, MessageData } from './message'
import { MessageInput } from './message-input'
import { Spinner } from '@/components/ui/spinner'
import { Card } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

interface ChatWindowProps {
  roomId: string
  roomType: 'club' | 'dm'
  currentUserId: string
  onLoadMessages?: (messages: MessageData[]) => void
}

/** Merge new messages into existing array, deduplicate by ID, sort by created_at */
function mergeMessages(existing: MessageData[], incoming: MessageData[]): MessageData[] {
  const map = new Map<string, MessageData>()
  for (const msg of existing) {
    map.set(msg.id, msg)
  }
  for (const msg of incoming) {
    map.set(msg.id, msg)
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
}

export function ChatWindow({
  roomId,
  roomType,
  currentUserId,
  onLoadMessages,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<MessageData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastPollTimeRef = useRef<string>(new Date().toISOString())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)

  const apiBase = roomType === 'club' ? `/api/club/${roomId}` : `/api/dm/rooms/${roomId}`

  // Initial load
  useEffect(() => {
    const loadInitialMessages = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`${apiBase}/messages?limit=50`)
        if (!response.ok) throw new Error('Failed to load messages')

        const data = await response.json()
        setMessages(data.messages)
        lastPollTimeRef.current = data.timestamp
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load messages')
      } finally {
        setIsLoading(false)
      }
    }

    loadInitialMessages()
  }, [roomId, apiBase])

  // Auto-scroll to bottom
  useEffect(() => {
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, shouldAutoScroll])

  // Supabase Realtime subscription for new messages in this room
  useEffect(() => {
    const supabase = createClient()
    const table = roomType === 'dm' ? 'dm_messages' : 'club_messages'
    const filterColumn = roomType === 'dm' ? 'room_id' : 'club_id'

    const channel = supabase
      .channel(`chat-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table,
          filter: `${filterColumn}=eq.${roomId}`,
        },
        async (payload: any) => {
          const newMsg = payload.new
          if (!newMsg?.id) return

          // Fetch the full message with user info (realtime payload doesn't include joins)
          try {
            const response = await fetch(`${apiBase}/poll?after=${encodeURIComponent(lastPollTimeRef.current)}`)
            if (!response.ok) return

            const data = await response.json()
            if (data.messages && data.messages.length > 0) {
              setMessages((prev) => mergeMessages(prev, data.messages))
              lastPollTimeRef.current = data.timestamp
            }
          } catch (err) {
            console.error('Realtime fetch error:', err)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, roomType, apiBase])

  // Fallback polling every 15 seconds (in case realtime misses something)
  useEffect(() => {
    const poll = async () => {
      try {
        const response = await fetch(`${apiBase}/poll?after=${encodeURIComponent(lastPollTimeRef.current)}`)
        if (!response.ok) return

        const data = await response.json()
        if (data.messages && data.messages.length > 0) {
          setMessages((prev) => mergeMessages(prev, data.messages))
          lastPollTimeRef.current = data.timestamp
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }

    pollingIntervalRef.current = setInterval(poll, 15000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [apiBase])

  const handleSendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return

      try {
        setIsSending(true)
        setError(null)

        const response = await fetch(`${apiBase}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: trimmed }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to send message')
        }

        const newMessage = await response.json()
        // Use mergeMessages to prevent duplicates if polling already picked it up
        setMessages((prev) => mergeMessages(prev, [newMessage]))
        // Advance poll time so polling won't re-fetch this message
        lastPollTimeRef.current = new Date().toISOString()
        setShouldAutoScroll(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send message')
        throw err // Re-throw so MessageInput knows it failed
      } finally {
        setIsSending(false)
      }
    },
    [apiBase]
  )

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      try {
        const response = await fetch(`${apiBase}/messages/${messageId}`, {
          method: 'DELETE',
        })

        if (!response.ok) throw new Error('Failed to delete message')

        setMessages((prev) => prev.filter((m) => m.id !== messageId))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete message')
      }
    },
    [apiBase]
  )

  const handleReact = useCallback(
    async (messageId: string, emoji: string) => {
      try {
        const response = await fetch(`${apiBase}/reactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId, emoji }),
        })

        if (!response.ok) throw new Error('Failed to add reaction')

        // Refetch messages to get updated reactions
        const messagesResponse = await fetch(`${apiBase}/messages?limit=50`)
        if (messagesResponse.ok) {
          const data = await messagesResponse.json()
          setMessages(data.messages)
        }
      } catch (err) {
        console.error('Reaction error:', err)
      }
    },
    [apiBase]
  )

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget
    const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 100
    setShouldAutoScroll(isNearBottom)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-accent/10">
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive text-sm m-4 rounded-md">
          {error}
        </div>
      )}

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto space-y-1 p-4 md:px-8 lg:px-16"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No messages yet. Start a conversation!
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id}>
              <Message
                message={message}
                isOwn={message.user_id === currentUserId}
                onDelete={handleDeleteMessage}
                onReact={handleReact}
              />
            </div>
          ))
        )}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      <div className="border-t p-3 md:p-4 bg-background">
        <MessageInput
          onSend={handleSendMessage}
          disabled={isSending}
          placeholder="Type a message... (Shift+Enter for new line)"
        />
      </div>
    </div>
  )
}
