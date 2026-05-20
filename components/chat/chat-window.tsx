'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Message, MessageData } from './message'
import { MessageInput } from './message-input'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { Pin, X, ChevronDown, ChevronUp, Shield, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { BlockCheckResult } from '@/hooks/use-block-user'
import {
  cacheMessages,
  getCachedMessages,
  updateLastSync,
  addPendingMessage,
  updateMessageStatus,
  getPendingMessages,
  type MessageStatus,
} from '@/lib/message-cache'
import { subscribeToTyping, sendTypingBroadcast } from '@/lib/typing-broadcast'
import { getMessageQueueWorker } from '@/lib/message-queue'
import type { ThemeSettings } from './theme-picker'

// Generate UUID using native crypto API
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

interface ChatWindowProps {
  roomId: string
  roomType: 'club' | 'dm'
  currentUserId: string
  highlightMessageId?: string | null
  onLoadMessages?: (messages: MessageData[]) => void
  themeColor?: string
  themeSettings?: ThemeSettings
  otherUserId?: string | null
}

/** Normalize Supabase relation names to the generic names used by Message component */
function normalizeMessage(msg: any): MessageData {
  return {
    ...msg,
    reactions:
      msg.reactions ||
      msg.dm_message_reactions ||
      msg.club_message_reactions ||
      [],
    replies:
      msg.replies ||
      msg.dm_message_replies ||
      msg.club_message_replies ||
      [],
    reads: msg.reads || [],
  }
}

/**
 * Merge a single read receipt into the messages list (used for realtime
 * INSERTs from Supabase or polling deltas).
 */
function applyRead(
  messages: MessageData[],
  read: {
    message_id: string
    user_id: string
    read_at: string
    users?: { username: string; avatar_url: string | null } | null
  }
): MessageData[] {
  return messages.map((m) => {
    if (m.id !== read.message_id) return m
    const existing = m.reads || []
    if (existing.some((r) => r.user_id === read.user_id)) return m
    return {
      ...m,
      reads: [
        ...existing,
        {
          user_id: read.user_id,
          read_at: read.read_at,
          users: read.users || null,
        },
      ],
    }
  })
}

function normalizeMessages(messages: any[]): MessageData[] {
  return messages.map(normalizeMessage)
}

/**
 * Enrich messages with reply_to data by looking up parent messages
 * from the loaded messages list.
 */
function enrichWithReplyTo(messages: MessageData[]): MessageData[] {
  const messageMap = new Map<string, MessageData>()
  for (const msg of messages) {
    messageMap.set(msg.id, msg)
  }

  return messages.map((msg) => {
    // Check if this message has a reply record pointing to a parent
    const replyRecord = msg.replies?.[0]
    if (replyRecord && replyRecord.reply_to_message_id) {
      const parentMsg = messageMap.get(replyRecord.reply_to_message_id)
      if (parentMsg) {
        return {
          ...msg,
          reply_to: {
            id: parentMsg.id,
            content: parentMsg.content,
            user_id: parentMsg.user_id,
            users: parentMsg.users,
          },
        }
      }
    }
    return msg
  })
}

/** Merge new messages into existing array, deduplicate by ID, sort by created_at */
function mergeMessages(existing: MessageData[], incoming: MessageData[]): MessageData[] {
  const map = new Map<string, MessageData>()
  for (const msg of existing) {
    map.set(msg.id, msg)
  }
  for (const msg of incoming) {
    map.set(msg.id, normalizeMessage(msg))
  }
  const sorted = Array.from(map.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  return enrichWithReplyTo(sorted)
}

// --- Pinned messages persistence via localStorage ---
function getPinnedKey(roomId: string): string {
  return `chat-pinned-${roomId}`
}

function loadPinnedIds(roomId: string): Set<string> {
  try {
    const raw = localStorage.getItem(getPinnedKey(roomId))
    if (raw) {
      return new Set(JSON.parse(raw) as string[])
    }
  } catch {
    // ignore parse errors
  }
  return new Set()
}

function savePinnedIds(roomId: string, ids: Set<string>): void {
  localStorage.setItem(getPinnedKey(roomId), JSON.stringify(Array.from(ids)))
}

export function ChatWindow({
  roomId,
  roomType,
  currentUserId,
  highlightMessageId,
  onLoadMessages,
  themeColor: themeColorProp = '#0A7CFF',
  themeSettings,
  otherUserId,
}: ChatWindowProps) {
  // Support both old themeColor prop and new themeSettings
  const effectiveThemeColor = themeSettings?.themeColor || themeColorProp
  const backgroundType = themeSettings?.backgroundType || 'default'
  const backgroundValue = themeSettings?.backgroundValue
  const backgroundOpacity = themeSettings?.backgroundOpacity ?? 1.0
  const t = useTranslations('chatWindow')
  const [messages, setMessages] = useState<MessageData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<MessageData | null>(null)
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set())
  const [showPinnedBanner, setShowPinnedBanner] = useState(true)
  const lastPollTimeRef = useRef<string>(new Date().toISOString())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  const [blockStatus, setBlockStatus] = useState<BlockCheckResult | null>(null)
  const [showTimestamps, setShowTimestamps] = useState(false)
  const swipeTouchStartRef = useRef<{ x: number; y: number } | null>(null)

  const apiBase = roomType === 'club' ? `/api/club/${roomId}` : `/api/dm/rooms/${roomId}`
  const lastReadMessageIdRef = useRef<string | null>(null)
  const readDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const typingUnsubscribeRef = useRef<(() => void) | null>(null)
  const [typingUsers, setTypingUsers] = useState<Map<string, { username: string; timestamp: number }>>(new Map())
  const typingDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const [currentUserInfo, setCurrentUserInfo] = useState<{ username: string } | null>(null)

  // Load current user info on mount
  useEffect(() => {
    const fetchUserInfo = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('users').select('username').eq('id', currentUserId).single()
      if (data) {
        setCurrentUserInfo(data)
      }
    }
    if (currentUserId) {
      fetchUserInfo()
    }
  }, [currentUserId])

  // Fetch block status for DM rooms
  useEffect(() => {
    if (!otherUserId || roomType !== 'dm') return

    const fetchBlockStatus = async () => {
      try {
        const response = await fetch(`/api/blocks/check/${otherUserId}`)
        if (response.ok) {
          const data = await response.json()
          setBlockStatus(data)
        }
      } catch (err) {
        console.error('Error fetching block status:', err)
      }
    }

    fetchBlockStatus()

    // Subscribe to realtime block changes
    const supabase = createClient()
    const channel = supabase.channel(`block-status-${otherUserId}`)

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_blocks',
      },
      () => {
        fetchBlockStatus()
      }
    )

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [otherUserId, roomType])

  // Handle unblock action
  const handleUnblock = useCallback(async () => {
    if (!otherUserId) return
    try {
      const response = await fetch(`/api/blocks/${otherUserId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setBlockStatus(prev => prev ? { ...prev, hasBlocked: false, canInteract: !prev.isBlockedBy } : null)
      }
    } catch (err) {
      console.error('Error unblocking user:', err)
    }
  }, [otherUserId])

  // Handle typing broadcast
  const handleTyping = useCallback(
    async (isTyping: boolean) => {
      if (!currentUserInfo?.username) return
      const supabase = createClient()
      await sendTypingBroadcast(roomId, roomType, currentUserId, currentUserInfo.username, isTyping, supabase)
    },
    [roomId, roomType, currentUserId, currentUserInfo]
  )

  // Load pinned IDs from localStorage on mount
  useEffect(() => {
    setPinnedIds(loadPinnedIds(roomId))
  }, [roomId])

  // Apply pin state to messages
  const messagesWithPinState = messages.map((msg) => ({
    ...msg,
    is_pinned: pinnedIds.has(msg.id),
  }))

  // Get the pinned messages for banner display
  const pinnedMessages = messagesWithPinState.filter((m) => m.is_pinned)

  /**
   * Compute which reader avatars to render under each message.
   * Messenger semantics: each reader appears only under the *latest* own
   * message they have read. Walk messages from newest to oldest, claim
   * each reader on the first own-message we encounter that has them.
   */
  const readerIdsByMessage: Record<string, string[]> = {}
  {
    const claimed = new Set<string>()
    for (let i = messagesWithPinState.length - 1; i >= 0; i--) {
      const m = messagesWithPinState[i]
      if (m.user_id !== currentUserId) continue
      const ids: string[] = []
      for (const r of m.reads || []) {
        if (claimed.has(r.user_id)) continue
        claimed.add(r.user_id)
        ids.push(r.user_id)
      }
      if (ids.length > 0) readerIdsByMessage[m.id] = ids
    }
  }

  // Initial load with cache-first strategy
  useEffect(() => {
    const loadInitialMessages = async () => {
      try {
        setIsLoading(true)

        // Try to load from IndexedDB cache first
        const { messages: cachedMessages, lastSyncAt } = await getCachedMessages(roomId, roomType)

        if (cachedMessages.length > 0) {
          // Show cached messages immediately
          const normalized = normalizeMessages(cachedMessages)
          setMessages(enrichWithReplyTo(normalized))
          if (lastSyncAt) {
            lastPollTimeRef.current = lastSyncAt
          }
          setIsLoading(false) // Hide skeleton early
        }

        // Sync with server for any new messages
        const response = await fetch(`${apiBase}/messages?limit=50`)
        if (!response.ok) throw new Error(t('loadFailed'))

        const data = await response.json()
        const normalized = normalizeMessages(data.messages)
        const enriched = enrichWithReplyTo(normalized)

        // Merge with existing messages
        setMessages((prev) => mergeMessages(prev, enriched))

        // Update cache and sync timestamp
        if (data.messages && data.messages.length > 0) {
          await cacheMessages(roomId, roomType, data.messages)
          const lastMsg = data.messages[data.messages.length - 1]
          await updateLastSync(roomId, roomType, lastMsg.created_at)
          lastPollTimeRef.current = data.timestamp
        }

        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('loadFailed'))
      } finally {
        setIsLoading(false)
      }
    }

    loadInitialMessages()
  }, [roomId, apiBase, roomType, t])

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

          try {
            const response = await fetch(`${apiBase}/poll?after=${encodeURIComponent(lastPollTimeRef.current)}`)
            if (!response.ok) return

            const data = await response.json()
            if (data.messages && data.messages.length > 0) {
              setMessages((prev) => mergeMessages(prev, data.messages))
              lastPollTimeRef.current = data.timestamp
              // Cache new messages
              await cacheMessages(roomId, roomType, data.messages)
              await updateLastSync(roomId, roomType, data.timestamp)
            }
            // Remove deleted messages
            if (data.deleted_ids && data.deleted_ids.length > 0) {
              const deletedSet = new Set(data.deleted_ids)
              setMessages((prev) => prev.filter((m) => !deletedSet.has(m.id)))
            }
            if (data.reads && data.reads.length > 0) {
              setMessages((prev) => {
                let next = prev
                for (const r of data.reads) next = applyRead(next, r)
                return next
              })
            }
          } catch (err) {
            console.error('Realtime fetch error:', err)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table,
          filter: `${filterColumn}=eq.${roomId}`,
        },
        (payload: any) => {
          const updated = payload.new
          if (!updated?.id) return

          // If message was soft-deleted, remove it from the list
          if (updated.deleted_at) {
            setMessages((prev) => prev.filter((m) => m.id !== updated.id))
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reads',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload: any) => {
          const row = payload.new
          if (!row?.message_id || !row?.user_id) return
          if (row.user_id === currentUserId) return
          // Fetch reader's profile for avatar (best-effort)
          let users: { username: string; avatar_url: string | null } | null = null
          try {
            const { data } = await supabase
              .from('users')
              .select('username, avatar_url')
              .eq('id', row.user_id)
              .single()
            if (data) users = data as any
          } catch {
            // ignore
          }
          setMessages((prev) =>
            applyRead(prev, {
              message_id: row.message_id,
              user_id: row.user_id,
              read_at: row.read_at,
              users,
            })
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, roomType, apiBase, currentUserId])

  // Broadcast-based typing indicator subscription
  useEffect(() => {
    const supabase = createClient()

    // Subscribe to typing broadcasts
    typingUnsubscribeRef.current = subscribeToTyping(
      roomId,
      roomType,
      supabase,
      (state) => {
        setTypingUsers((prev) => {
          const next = new Map(prev)
          if (state.isTyping) {
            next.set(state.userId, { username: state.username, timestamp: state.timestamp })
          } else {
            next.delete(state.userId)
          }
          return next
        })
      }
    )

    return () => {
      if (typingUnsubscribeRef.current) {
        typingUnsubscribeRef.current()
        typingUnsubscribeRef.current = null
      }
    }
  }, [roomId, roomType])

  // Fallback polling every 15 seconds
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
        // Remove deleted messages
        if (data.deleted_ids && data.deleted_ids.length > 0) {
          const deletedSet = new Set(data.deleted_ids)
          setMessages((prev) => prev.filter((m) => !deletedSet.has(m.id)))
        }
        // Apply incremental read receipts
        if (data.reads && data.reads.length > 0) {
          setMessages((prev) => {
            let next = prev
            for (const r of data.reads) next = applyRead(next, r)
            return next
          })
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }

    pollingIntervalRef.current = setInterval(poll, 5000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [apiBase])

  /**
   * Mark the latest visible message as read whenever messages list updates,
   * the user is near the bottom, and the document is visible. Debounced.
   */
  useEffect(() => {
    if (!currentUserId || messages.length === 0) return
    if (typeof document !== 'undefined' && document.hidden) return
    if (!shouldAutoScroll) return

    // Find the last message NOT authored by the current user
    let target: MessageData | null = null
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].user_id !== currentUserId && !messages[i].id.startsWith('temp-')) {
        target = messages[i]
        break
      }
    }
    if (!target) return
    if (lastReadMessageIdRef.current === target.id) return
    const messageId = target.id

    if (readDebounceRef.current) clearTimeout(readDebounceRef.current)
    readDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${apiBase}/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId }),
        })
        if (res.ok) {
          lastReadMessageIdRef.current = messageId
        }
      } catch (err) {
        console.error('Mark-as-read failed:', err)
      }
    }, 600)

    return () => {
      if (readDebounceRef.current) clearTimeout(readDebounceRef.current)
    }
  }, [messages, shouldAutoScroll, currentUserId, apiBase])

  const handleSendMessage = useCallback(
    async (content: string, username?: string) => {
      const trimmed = content.trim()
      if (!trimmed) return

      // Broadcast stop typing
      if (username) {
        const supabase = createClient()
        await sendTypingBroadcast(roomId, roomType, currentUserId, username, false, supabase)
      }

      // Generate client-side UUID for idempotency
      const clientMessageId = generateUUID()
      const tempId = `temp-${clientMessageId}`

      // Offline-first: show message instantly with "pending" status
      const optimisticMsg: MessageData = {
        id: tempId,
        content: trimmed,
        user_id: currentUserId,
        created_at: new Date().toISOString(),
        users: { username: username || t('you') },
        reactions: [],
        replies: [],
        reply_to: replyingTo ? {
          id: replyingTo.id,
          content: replyingTo.content,
          user_id: replyingTo.user_id,
          users: replyingTo.users,
        } : null,
        status: 'pending' as MessageStatus,
        client_message_id: clientMessageId,
      }

      setMessages((prev) => [...prev, optimisticMsg])
      setShouldAutoScroll(true)
      setReplyingTo(null)
      setError(null)

      // Add to pending queue for background retry
      await addPendingMessage(
        clientMessageId,
        roomId,
        roomType,
        trimmed,
        replyingTo?.id,
        undefined,
        undefined
      )

      // Cache the pending message
      await cacheMessages(roomId, roomType, [optimisticMsg])

      // Start the message queue worker if not already running
      const worker = getMessageQueueWorker({
        onMessageSent: async (sentClientId, serverMessage) => {
          if (sentClientId === clientMessageId) {
            // Replace temp message with server message
            const normalized = normalizeMessage(serverMessage)
            setMessages((prev) =>
              mergeMessages(
                prev.filter((m) => m.id !== tempId),
                [{ ...normalized, status: 'sent' as MessageStatus }]
              )
            )
            // Update cache with sent status
            await cacheMessages(roomId, roomType, [{ ...normalized, status: 'sent' }])
            await updateLastSync(roomId, roomType, serverMessage.created_at)
          }
        },
        onMessageFailed: async (failedClientId) => {
          if (failedClientId === clientMessageId) {
            // Mark as failed in UI
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempId ? { ...m, status: 'failed' as MessageStatus } : m
              )
            )
            await updateMessageStatus(tempId, 'failed')
          }
        },
      })
      worker.start()

      // If online, try sending immediately
      if (navigator.onLine) {
        try {
          const body: Record<string, string> = {
            content: trimmed,
            clientMessageId,
          }
          if (replyingTo) {
            body.replyToMessageId = replyingTo.id
          }

          const response = await fetch(`${apiBase}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

          if (!response.ok) {
            // Will be handled by retry queue
            console.log('Message will be retried:', clientMessageId)
            return
          }

          const newMessage = await response.json()
          const normalized = normalizeMessage(newMessage)

          // Remove from pending queue
          const { removePendingMessage } = await import('@/lib/message-cache')
          await removePendingMessage(clientMessageId)

          // Update UI with sent message
          setMessages((prev) =>
            mergeMessages(
              prev.filter((m) => m.id !== tempId),
              [{ ...normalized, status: 'sent' as MessageStatus }]
            )
          )

          // Cache with sent status
          await cacheMessages(roomId, roomType, [{ ...normalized, status: 'sent' }])
          await updateLastSync(roomId, roomType, newMessage.created_at)
        } catch (err) {
          // Network error - message stays in queue for retry
          console.log('Network error, message queued for retry:', clientMessageId)
        }
      }
    },
    [apiBase, replyingTo, currentUserId, t, roomId, roomType]
  )

  const handleSendMedia = useCallback(
    async (file: File, mediaType: 'image' | 'video', caption?: string) => {
      try {
        setIsSending(true)
        setError(null)

        // 1. Upload file to Supabase Storage
        const formData = new FormData()
        formData.append('file', file)
        formData.append('roomId', roomId)
        formData.append('roomType', roomType)

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({}))
          throw new Error(errorData.error || t('sendMediaFailed'))
        }

        const uploadData = await uploadResponse.json()

        // 2. Send message with media URL
        const body: Record<string, string> = {
          content: caption || '',
          mediaUrl: uploadData.url,
          mediaType: uploadData.mediaType,
        }
        if (replyingTo) {
          body.replyToMessageId = replyingTo.id
        }

        const response = await fetch(`${apiBase}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || t('sendFailed'))
        }

        const newMessage = await response.json()
        setMessages((prev) => mergeMessages(prev, [normalizeMessage(newMessage)]))
        lastPollTimeRef.current = new Date().toISOString()
        setShouldAutoScroll(true)
        setReplyingTo(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('sendMediaFailed'))
        throw err
      } finally {
        setIsSending(false)
      }
    },
    [apiBase, roomId, roomType, replyingTo, t]
  )

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      try {
        const response = await fetch(`${apiBase}/messages/${messageId}`, {
          method: 'DELETE',
        })

        if (!response.ok) throw new Error(t('deleteFailed'))

        setMessages((prev) => prev.filter((m) => m.id !== messageId))
        // Also remove from pinned if it was pinned
        setPinnedIds((prev) => {
          const next = new Set(prev)
          next.delete(messageId)
          savePinnedIds(roomId, next)
          return next
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : t('deleteFailed'))
      }
    },
    [apiBase, roomId, t]
  )

  const handleRetry = useCallback(
    async (clientMessageId: string) => {
      // Find the failed message
      const failedMessage = messages.find(
        (m) => m.client_message_id === clientMessageId && m.status === 'failed'
      )
      if (!failedMessage) return

      // Update status to pending
      setMessages((prev) =>
        prev.map((m) =>
          m.client_message_id === clientMessageId ? { ...m, status: 'pending' as MessageStatus } : m
        )
      )

      // Trigger the message queue worker
      const worker = getMessageQueueWorker({
        onMessageSent: async (sentClientId, serverMessage) => {
          if (sentClientId === clientMessageId) {
            const normalized = normalizeMessage(serverMessage)
            setMessages((prev) =>
              mergeMessages(
                prev.filter((m) => m.client_message_id !== clientMessageId),
                [{ ...normalized, status: 'sent' as MessageStatus }]
              )
            )
            await cacheMessages(roomId, roomType, [{ ...normalized, status: 'sent' }])
          }
        },
        onMessageFailed: async (failedClientId) => {
          if (failedClientId === clientMessageId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.client_message_id === clientMessageId
                  ? { ...m, status: 'failed' as MessageStatus }
                  : m
              )
            )
          }
        },
      })
      worker.start()

      // If online, try sending immediately
      if (navigator.onLine && failedMessage.content) {
        try {
          const body: Record<string, string> = {
            content: failedMessage.content,
            clientMessageId,
          }
          if (failedMessage.reply_to?.id) {
            body.replyToMessageId = failedMessage.reply_to.id
          }

          const response = await fetch(`${apiBase}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

          if (response.ok) {
            const newMessage = await response.json()
            const normalized = normalizeMessage(newMessage)
            setMessages((prev) =>
              mergeMessages(
                prev.filter((m) => m.client_message_id !== clientMessageId),
                [{ ...normalized, status: 'sent' as MessageStatus }]
              )
            )
            await cacheMessages(roomId, roomType, [{ ...normalized, status: 'sent' }])
          }
        } catch {
          // Network error - will be handled by queue
        }
      }
    },
    [apiBase, messages, roomId, roomType]
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

        const messagesResponse = await fetch(`${apiBase}/messages?limit=50`)
        if (messagesResponse.ok) {
          const data = await messagesResponse.json()
          const normalized = normalizeMessages(data.messages)
          setMessages(enrichWithReplyTo(normalized))
        }
      } catch (err) {
        console.error('Reaction error:', err)
      }
    },
    [apiBase]
  )

  const handleReply = useCallback((message: MessageData) => {
    setReplyingTo(message)
  }, [])

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null)
  }, [])

  const handlePin = useCallback((message: MessageData) => {
    setPinnedIds((prev) => {
      const next = new Set(prev)
      next.add(message.id)
      savePinnedIds(roomId, next)
      return next
    })
    setShowPinnedBanner(true)
  }, [roomId])

  const handleUnpin = useCallback((messageId: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev)
      next.delete(messageId)
      savePinnedIds(roomId, next)
      return next
    })
  }, [roomId])

  const scrollToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('animate-pin-highlight')
      setTimeout(() => el.classList.remove('animate-pin-highlight'), 2000)
    }
  }, [])

  useEffect(() => {
    if (highlightMessageId && !isLoading && messages.length > 0) {
      const timer = setTimeout(() => scrollToMessage(highlightMessageId), 300)
      return () => clearTimeout(timer)
    }
  }, [highlightMessageId, isLoading, messages.length, scrollToMessage])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget
    const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 100
    setShouldAutoScroll(isNearBottom)
  }

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    swipeTouchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipeTouchStartRef.current) return
    const touch = e.touches[0]
    const dx = swipeTouchStartRef.current.x - touch.clientX
    const dy = Math.abs(swipeTouchStartRef.current.y - touch.clientY)
    if (dx > 30 && dy < 60) {
      setShowTimestamps(true)
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    swipeTouchStartRef.current = null
    setShowTimestamps(false)
  }, [])

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-accent/10">
        <div className="flex-1 overflow-hidden p-4 md:px-8 lg:px-16 space-y-4">
          {/* Skeleton messages - alternating left/right */}
          {[false, false, true, false, true, true, false].map((isOwn, i) => (
            <div key={i} className={cn('flex gap-3', isOwn && 'flex-row-reverse')}>
              {!isOwn && (
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0 mt-auto mb-1" />
              )}
              <div className={cn('flex flex-col gap-1.5 max-w-[60%]', isOwn && 'items-end')}>
                {!isOwn && <Skeleton className="h-3 w-16" />}
                <Skeleton
                  className={cn(
                    'h-10 rounded-2xl',
                    isOwn ? 'rounded-tr-sm' : 'rounded-tl-sm',
                    i % 3 === 0 ? 'w-48' : i % 3 === 1 ? 'w-64' : 'w-36'
                  )}
                />
                {isOwn && <Skeleton className="h-2.5 w-12" />}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t p-3 md:p-4 bg-background">
          <div className="flex gap-2 items-end">
            <Skeleton className="h-10 w-10 rounded-md" />
            <Skeleton className="h-10 flex-1 rounded-md" />
            <Skeleton className="h-10 w-10 rounded-md" />
            <Skeleton className="h-10 w-10 rounded-md" />
          </div>
        </div>
      </div>
    )
  }

  // Compute background styles
  const getBackgroundStyles = (): React.CSSProperties => {
    if (backgroundType === 'default' || !backgroundValue) {
      return {}
    }
    if (backgroundType === 'color') {
      return { backgroundColor: backgroundValue }
    }
    if (backgroundType === 'image') {
      return {
        backgroundImage: `url(${backgroundValue})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    }
    return {}
  }

  const backgroundStyles = getBackgroundStyles()
  const needsOverlay = backgroundType === 'image' && backgroundValue

  return (
    <div className="flex flex-col h-full bg-accent/10 relative">
      {/* Background layer - pointer-events-none so it doesn't block interactions */}
      {backgroundType !== 'default' && backgroundValue && (
        <div 
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            ...backgroundStyles,
            opacity: backgroundType === 'image' ? backgroundOpacity : 1,
          }}
        />
      )}
      {/* Overlay for image backgrounds - also non-interactive */}
      {needsOverlay && (
        <div 
          className="absolute inset-0 z-[1] bg-background/40 pointer-events-none"
          style={{ opacity: 1 - (backgroundOpacity * 0.3) }}
        />
      )}
      {/* Content wrapper with z-index above background and subtle backdrop */}
      <div className="relative z-10 flex flex-col h-full backdrop-blur-[1px]">
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive text-sm m-4 rounded-md">
          {error}
        </div>
      )}

      {/* Pinned messages banner */}
      {pinnedMessages.length > 0 && showPinnedBanner && (
        <div className="border-b bg-amber-500/5 dark:bg-amber-500/10">
          <div className="flex items-center gap-2 px-4 py-2 md:px-8 lg:px-16">
            <Pin className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                {t('pinnedCount', { count: pinnedMessages.length })}
              </p>
              <button
                onClick={() => scrollToMessage(pinnedMessages[pinnedMessages.length - 1].id)}
                className="text-xs text-muted-foreground hover:text-foreground truncate block max-w-full text-left transition-colors"
              >
                {pinnedMessages[pinnedMessages.length - 1].users.username}: {pinnedMessages[pinnedMessages.length - 1].content}
              </button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPinnedBanner(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Collapsed pinned indicator (when banner is hidden) */}
      {pinnedMessages.length > 0 && !showPinnedBanner && (
        <button
          onClick={() => setShowPinnedBanner(true)}
          className="flex items-center gap-1.5 px-4 py-1.5 md:px-8 lg:px-16 border-b text-xs text-amber-500 hover:bg-amber-500/5 transition-colors"
        >
          <Pin className="h-3 w-3" />
          <span>{t('pinnedCollapsed', { count: pinnedMessages.length })}</span>
          <ChevronDown className="h-3 w-3" />
        </button>
      )}

      <div
        ref={containerRef}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 overflow-y-auto space-y-1 p-4 md:px-8 lg:px-16"
      >
        {messagesWithPinState.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {t('noMessages')}
          </div>
        ) : (
          messagesWithPinState.map((message, idx, arr) => {
            const prev = arr[idx - 1]
            const next = arr[idx + 1]
            const isFirstInGroup = !prev || prev.user_id !== message.user_id
            const isLastInGroup = !next || next.user_id !== message.user_id
            return (
              <div key={message.id} id={`msg-${message.id}`}>
                <Message
                  message={message}
                  isOwn={message.user_id === currentUserId}
                  currentUserId={currentUserId}
                  onDelete={handleDeleteMessage}
                  onReact={handleReact}
                  onReply={handleReply}
                  onPin={handlePin}
                  onUnpin={handleUnpin}
                  onRetry={handleRetry}
                  readerIdsToRender={readerIdsByMessage[message.id]}
                  themeColor={effectiveThemeColor}
                  showAvatar={isLastInGroup}
                  isFirstInGroup={isFirstInGroup}
                  showTimestamp={showTimestamps}
                />
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* Typing indicator */}
      {typingUsers.size > 0 && (
        <div className="px-4 py-1 text-xs text-muted-foreground flex items-center gap-1">
          <span className="animate-pulse">●</span>
          <span>
            {Array.from(typingUsers.values())
              .map((u) => u.username)
              .join(', ')}{' '}
            {typingUsers.size === 1 ? t('isTyping') : t('areTyping')}
          </span>
        </div>
      )}

      <div className="border-t p-3 md:p-4 bg-background">
        {/* Blocked input overlay - shown when cannot interact */}
        {blockStatus && roomType === 'dm' && !blockStatus.canInteract && (
          <div className="flex items-center justify-center py-3 text-center">
            {blockStatus.isBlockedBy ? (
              // Being blocked - just show message
              <div className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium",
                "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              )}>
                <Shield className="h-4 w-4" />
                <span>{t('blockedYouTitle')}</span>
              </div>
            ) : (
              // Has blocked - clickable to unblock
              <button
                onClick={handleUnblock}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold",
                  "bg-amber-500 text-white hover:bg-amber-600",
                  "dark:bg-amber-600 dark:hover:bg-amber-700",
                  "shadow-md hover:shadow-lg transition-all",
                  "cursor-pointer"
                )}
              >
                <ShieldOff className="h-4 w-4" />
                <span>{t('unblockButton')}</span>
              </button>
            )}
          </div>
        )}

        {/* Normal input - hidden when blocked */}
        {(!blockStatus || roomType !== 'dm' || blockStatus.canInteract) && (
          <MessageInput
            onSend={(content) => handleSendMessage(content, currentUserInfo?.username)}
            onSendMedia={handleSendMedia}
            onTyping={handleTyping}
            disabled={false}
            placeholder={t('placeholder')}
            replyingTo={replyingTo ? {
              id: replyingTo.id,
              content: replyingTo.content,
              username: replyingTo.users.username,
            } : null}
            onCancelReply={handleCancelReply}
          />
        )}
      </div>
      </div>{/* End content wrapper */}
    </div>
  )
}
