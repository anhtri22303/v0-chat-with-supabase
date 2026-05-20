/**
 * Message Queue Worker for offline-first support.
 * Handles sending pending messages with exponential backoff retry.
 * Implements MSYS-like behavior for web.
 */

import {
  getPendingMessagesReadyForRetry,
  removePendingMessage,
  updatePendingMessageRetry,
  updateMessageStatus,
  type MessageStatus,
} from './message-cache'

// Exponential backoff delays (in ms): 1s, 2s, 4s, 8s, 16s, max 30s
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000]
const MAX_RETRIES = 10

interface QueueWorkerOptions {
  onMessageSent?: (clientMessageId: string, serverMessage: any) => void
  onMessageFailed?: (clientMessageId: string, error: Error) => void
  onStatusChange?: (clientMessageId: string, status: MessageStatus) => void
}

class MessageQueueWorker {
  private isRunning = false
  private checkInterval: NodeJS.Timeout | null = null
  private options: QueueWorkerOptions
  private abortController: AbortController | null = null

  constructor(options: QueueWorkerOptions = {}) {
    this.options = options
  }

  /**
   * Start the queue worker
   */
  start(): void {
    if (this.isRunning) return

    this.isRunning = true
    this.abortController = new AbortController()

    // Check immediately
    this.processQueue()

    // Then check every 3 seconds
    this.checkInterval = setInterval(() => {
      this.processQueue()
    }, 3000)

    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline)
    }

    console.log('[MessageQueue] Worker started')
  }

  /**
   * Stop the queue worker
   */
  stop(): void {
    if (!this.isRunning) return

    this.isRunning = false
    this.abortController?.abort()

    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline)
    }

    console.log('[MessageQueue] Worker stopped')
  }

  /**
   * Process all pending messages ready for retry
   */
  private async processQueue(): Promise<void> {
    if (!this.isRunning || !navigator.onLine) return

    try {
      const pendingMessages = await getPendingMessagesReadyForRetry()

      for (const item of pendingMessages) {
        if (!this.isRunning) break

        await this.sendMessage(item)
      }
    } catch (err) {
      console.error('[MessageQueue] Error processing queue:', err)
    }
  }

  /**
   * Send a single pending message
   */
  private async sendMessage(item: {
    id: string
    roomId: string
    roomType: 'dm' | 'club'
    content: string
    replyToMessageId?: string
    mediaUrl?: string
    mediaType?: string
    retryCount: number
  }): Promise<void> {
    const apiBase =
      item.roomType === 'club'
        ? `/api/club/${item.roomId}`
        : `/api/dm/rooms/${item.roomId}`

    try {
      this.options.onStatusChange?.(item.id, 'pending')

      const body: Record<string, string> = {
        content: item.content,
        clientMessageId: item.id, // Send clientMessageId for idempotency
      }

      if (item.replyToMessageId) {
        body.replyToMessageId = item.replyToMessageId
      }
      if (item.mediaUrl) {
        body.mediaUrl = item.mediaUrl
        body.mediaType = item.mediaType || 'image'
      }

      const response = await fetch(`${apiBase}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: this.abortController?.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`)
      }

      const serverMessage = await response.json()

      // Success! Remove from pending queue
      await removePendingMessage(item.id)

      // Update status to sent
      if (serverMessage.id) {
        await updateMessageStatus(serverMessage.id, 'sent')
      }

      this.options.onMessageSent?.(item.id, serverMessage)
      this.options.onStatusChange?.(item.id, 'sent')

      console.log(`[MessageQueue] Message ${item.id} sent successfully`)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return // Worker was stopped
      }

      console.error(`[MessageQueue] Failed to send message ${item.id}:`, err)

      const nextRetryCount = item.retryCount + 1

      if (nextRetryCount >= MAX_RETRIES) {
        // Max retries reached, mark as failed
        await removePendingMessage(item.id)
        this.options.onMessageFailed?.(item.id, err instanceof Error ? err : new Error(String(err)))
        this.options.onStatusChange?.(item.id, 'failed')
        console.error(`[MessageQueue] Message ${item.id} failed after ${MAX_RETRIES} retries`)
      } else {
        // Schedule next retry with exponential backoff
        const delayIndex = Math.min(nextRetryCount - 1, RETRY_DELAYS.length - 1)
        const nextDelay = RETRY_DELAYS[delayIndex]

        await updatePendingMessageRetry(item.id, nextRetryCount, nextDelay)
        console.log(`[MessageQueue] Message ${item.id} will retry in ${nextDelay}ms (attempt ${nextRetryCount})`)
      }
    }
  }

  /**
   * Handle browser coming back online
   */
  private handleOnline = (): void => {
    console.log('[MessageQueue] Browser online, processing queue immediately')
    this.processQueue()
  }

  /**
   * Manually retry a failed message
   */
  async retryMessage(clientMessageId: string): Promise<boolean> {
    // This would require storing failed messages separately
    // For now, just re-trigger the queue processing
    await this.processQueue()
    return true
  }
}

// Singleton instance
let globalWorker: MessageQueueWorker | null = null

export function getMessageQueueWorker(options?: QueueWorkerOptions): MessageQueueWorker {
  if (!globalWorker) {
    globalWorker = new MessageQueueWorker(options)
  }
  return globalWorker
}

export function startMessageQueue(options?: QueueWorkerOptions): MessageQueueWorker {
  const worker = getMessageQueueWorker(options)
  worker.start()
  return worker
}

export function stopMessageQueue(): void {
  globalWorker?.stop()
}

export { MessageQueueWorker }
export type { QueueWorkerOptions }
