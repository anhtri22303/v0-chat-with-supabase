'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Message, MessageData } from './message'
import { MessageInput } from './message-input'
import { Spinner } from '@/components/ui/spinner'
import { Card } from '@/components/ui/card'

interface ChatWindowProps {
  roomId: string
  roomType: 'club' | 'dm'
  currentUserId: string
  onLoadMessages?: (messages: MessageData[]) => void
}

export function ChatWindow({
  roomId,
  roomType,
  currentUserId,
  onLoadMessages,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<MessageData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastPollTime, setLastPollTime] = useState<string>(new Date().toISOString())
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
        setLastPollTime(data.timestamp)
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

  // Polling for new messages
  useEffect(() => {
    const poll = async () => {
      try {
        const response = await fetch(`${apiBase}/poll?after=${encodeURIComponent(lastPollTime)}`)
        if (!response.ok) return

        const data = await response.json()
        if (data.messages && data.messages.length > 0) {
          setMessages((prev) => [...prev, ...data.messages])
          setLastPollTime(data.timestamp)
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }

    pollingIntervalRef.current = setInterval(poll, 2000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [lastPollTime, apiBase])

  const handleSendMessage = useCallback(
    async (content: string) => {
      try {
        const response = await fetch(`${apiBase}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        })

        if (!response.ok) throw new Error('Failed to send message')

        const newMessage = await response.json()
        setMessages((prev) => [...prev, newMessage])
        setShouldAutoScroll(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send message')
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
    <div className="flex flex-col h-full">
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
          {error}
        </div>
      )}

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto space-y-1 p-4 group"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
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
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-4 bg-background">
        <MessageInput
          onSend={handleSendMessage}
          placeholder="Type a message... (Shift+Enter for new line)"
        />
      </div>
    </div>
  )
}
