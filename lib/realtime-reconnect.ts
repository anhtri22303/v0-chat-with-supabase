/**
 * Auto-reconnect utilities for Supabase Realtime.
 * Handles connection drops and automatic recovery.
 */

import { createClient } from '@/lib/supabase/client'

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

interface ReconnectConfig {
  maxRetries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  onStateChange?: (state: ConnectionState) => void
}

class RealtimeReconnectManager {
  private channels = new Map<string, any>()
  private retryCounts = new Map<string, number>()
  private reconnectTimers = new Map<string, NodeJS.Timeout>()
  private config: ReconnectConfig

  constructor(config: ReconnectConfig = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 10,
      baseDelayMs: config.baseDelayMs ?? 1000,
      maxDelayMs: config.maxDelayMs ?? 30000,
      onStateChange: config.onStateChange,
    }
  }

  /**
   * Subscribe to a channel with auto-reconnect
   */
  subscribe(
    channelName: string,
    handlers: {
      onMessage?: (payload: any) => void
      onStatusChange?: (status: string) => void
    }
  ): () => void {
    const supabase = createClient()

    const connect = () => {
      // Clean up existing
      const existing = this.channels.get(channelName)
      if (existing) {
        supabase.removeChannel(existing)
      }

      this.config.onStateChange?.('connecting')

      // Create new channel
      const channel = supabase
        .channel(channelName, {
          config: {
            broadcast: { self: false },
          },
        })
        .subscribe((status: string) => {
          handlers.onStatusChange?.(status)

          if (status === 'SUBSCRIBED') {
            this.retryCounts.set(channelName, 0)
            this.config.onStateChange?.('connected')

            // Clear any pending reconnect
            const timer = this.reconnectTimers.get(channelName)
            if (timer) {
              clearTimeout(timer)
              this.reconnectTimers.delete(channelName)
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED' || status === 'TIMED_OUT') {
            this.config.onStateChange?.('error')
            this.scheduleReconnect(channelName, handlers)
          }
        })

      this.channels.set(channelName, channel)
      return channel
    }

    const channel = connect()

    // Handle browser online/offline events
    const handleOnline = () => {
      console.log('Browser online, reconnecting...')
      this.retryCounts.set(channelName, 0)
      this.scheduleReconnect(channelName, handlers, 500)
    }

    const handleOffline = () => {
      console.log('Browser offline')
      this.config.onStateChange?.('disconnected')
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
    }

    // Return cleanup function
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }

      const timer = this.reconnectTimers.get(channelName)
      if (timer) {
        clearTimeout(timer)
      }

      const ch = this.channels.get(channelName)
      if (ch) {
        supabase.removeChannel(ch)
      }

      this.channels.delete(channelName)
      this.retryCounts.delete(channelName)
      this.reconnectTimers.delete(channelName)
    }
  }

  private scheduleReconnect(
    channelName: string,
    handlers: {
      onMessage?: (payload: any) => void
      onStatusChange?: (status: string) => void
    },
    delayOverride?: number
  ): void {
    const currentRetry = this.retryCounts.get(channelName) ?? 0

    if (currentRetry >= this.config.maxRetries!) {
      console.error(`Max retries exceeded for channel: ${channelName}`)
      this.config.onStateChange?.('error')
      return
    }

    // Exponential backoff with jitter
    const delay =
      delayOverride ??
      Math.min(
        this.config.baseDelayMs! * Math.pow(2, currentRetry) + Math.random() * 1000,
        this.config.maxDelayMs!
      )

    this.retryCounts.set(channelName, currentRetry + 1)

    console.log(`Scheduling reconnect for ${channelName} in ${delay}ms (retry ${currentRetry + 1})`)

    const timer = setTimeout(() => {
      console.log(`Reconnecting ${channelName}...`)
      this.subscribe(channelName, handlers)
    }, delay)

    this.reconnectTimers.set(channelName, timer)
  }

  /**
   * Disconnect all channels
   */
  disconnectAll(): void {
    const supabase = createClient()

    this.reconnectTimers.forEach((timer) => clearTimeout(timer))
    this.reconnectTimers.clear()

    this.channels.forEach((channel) => {
      supabase.removeChannel(channel)
    })
    this.channels.clear()
    this.retryCounts.clear()
  }
}

// Singleton instance for app-wide use
let globalManager: RealtimeReconnectManager | null = null

export function getRealtimeManager(config?: ReconnectConfig): RealtimeReconnectManager {
  if (!globalManager) {
    globalManager = new RealtimeReconnectManager(config)
  }
  return globalManager
}

export function resetRealtimeManager(): void {
  globalManager?.disconnectAll()
  globalManager = null
}

export { RealtimeReconnectManager }
export type { ConnectionState, ReconnectConfig }
