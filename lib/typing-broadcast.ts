/**
 * Broadcast-based typing indicator using Supabase Realtime.
 * Replaces database-polling with lightweight ephemeral messages.
 */

// Generic Supabase client type that works with both @supabase/ssr and @supabase/supabase-js
type SupabaseClientLike = {
  channel: (name: string, opts?: any) => RealtimeChannel
  removeChannel: (channel: RealtimeChannel) => void
}

type RealtimeChannel = {
  subscribe: (callback: (status: string) => void) => RealtimeChannel
  on: (type: string, filter: any, callback: (payload: any) => void) => RealtimeChannel
  send: (payload: any) => Promise<void>
  unsubscribe?: () => void
}

interface TypingState {
  userId: string
  username: string
  isTyping: boolean
  timestamp: number
}

type TypingCallback = (state: TypingState) => void

const channels = new Map<string, RealtimeChannel>()
const callbacks = new Map<string, Set<TypingCallback>>()
const typingTimers = new Map<string, NodeJS.Timeout>()

const TYPING_TIMEOUT = 3000 // Clear typing after 3s of inactivity
const BROADCAST_EVENT = 'typing'

/**
 * Subscribe to typing indicators for a room
 */
export function subscribeToTyping(
  roomId: string,
  roomType: 'dm' | 'club',
  supabase: any,
  callback: TypingCallback
): () => void {
  const channelKey = `${roomType}:${roomId}`

  // Add callback
  if (!callbacks.has(channelKey)) {
    callbacks.set(channelKey, new Set())
  }
  callbacks.get(channelKey)!.add(callback)

  // Create channel if not exists
  if (!channels.has(channelKey)) {
    const channel = supabase.channel(`typing:${channelKey}`, {
      config: {
        broadcast: {
          self: false, // Don't receive own broadcasts
        },
      },
    })

    channel
      .on('broadcast', { event: BROADCAST_EVENT }, (payload: { payload: TypingState }) => {
        const state = payload.payload
        // Notify all subscribers
        callbacks.get(channelKey)?.forEach((cb) => cb(state))

        // Auto-clear typing after timeout
        const timerKey = `${channelKey}:${state.userId}`
        if (typingTimers.has(timerKey)) {
          clearTimeout(typingTimers.get(timerKey)!)
        }
        if (state.isTyping) {
          const timer = setTimeout(() => {
            callbacks.get(channelKey)?.forEach((cb) =>
              cb({
                ...state,
                isTyping: false,
                timestamp: Date.now(),
              })
            )
          }, TYPING_TIMEOUT)
          typingTimers.set(timerKey, timer)
        }
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Typing indicator subscribed: ${channelKey}`)
        }
      })

    channels.set(channelKey, channel)
  }

  // Return unsubscribe function
  return () => {
    const cbs = callbacks.get(channelKey)
    if (cbs) {
      cbs.delete(callback)
      if (cbs.size === 0) {
        // Clean up channel
        const channel = channels.get(channelKey)
        if (channel) {
          supabase.removeChannel(channel)
          channels.delete(channelKey)
        }
        callbacks.delete(channelKey)
      }
    }
  }
}

/**
 * Send typing indicator broadcast
 */
export async function sendTypingBroadcast(
  roomId: string,
  roomType: 'dm' | 'club',
  userId: string,
  username: string,
  isTyping: boolean,
  supabase: any
): Promise<void> {
  const channelKey = `${roomType}:${roomId}`
  let channel = channels.get(`typing:${channelKey}`)

  // Create ephemeral channel if not exists
  if (!channel) {
    const newChannel: RealtimeChannel = supabase.channel(`typing:${channelKey}`, {
      config: {
        broadcast: {
          self: false,
        },
      },
    })
    await new Promise<void>((resolve) => {
      newChannel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') resolve()
      })
    })
    channels.set(`typing:${channelKey}`, newChannel)
    channel = newChannel
  }

  await channel.send({
    type: 'broadcast',
    event: BROADCAST_EVENT,
    payload: {
      userId,
      username,
      isTyping,
      timestamp: Date.now(),
    },
  })
}

/**
 * Get current typing users for a room
 * Returns a Map of userId -> TypingState
 */
export function getTypingUsers(roomId: string, roomType: 'dm' | 'club'): Map<string, TypingState> {
  const channelKey = `${roomType}:${roomId}`
  const states = new Map<string, TypingState>()

  // This is a simple in-memory cache - in practice, components track this via callbacks
  return states
}

/**
 * Clear all typing subscriptions (e.g., on logout)
 */
export function clearAllTypingSubscriptions(supabase: any): void {
  channels.forEach((channel) => {
    supabase.removeChannel(channel)
  })
  channels.clear()
  callbacks.clear()
  typingTimers.forEach((timer) => clearTimeout(timer))
  typingTimers.clear()
}
