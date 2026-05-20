/**
 * IndexedDB-based message cache for offline support and faster initial load.
 * Implements SQLite-centric pattern from Messenger's architecture.
 */

const DB_NAME = 'chat-messages-cache'
const DB_VERSION = 2 // Bumped for new status field and queue store
const STORE_NAME = 'messages'
const META_STORE = 'metadata'
const QUEUE_STORE = 'pending_queue'

export type MessageStatus = 'pending' | 'sent' | 'failed' | 'delivered'

interface CachedMessage {
  id: string
  roomId: string
  roomType: 'dm' | 'club'
  data: any
  cachedAt: string
  status: MessageStatus
  retryCount?: number
  lastRetryAt?: string
  clientMessageId?: string
}

interface PendingQueueItem {
  id: string // clientMessageId
  roomId: string
  roomType: 'dm' | 'club'
  content: string
  replyToMessageId?: string
  mediaUrl?: string
  mediaType?: string
  createdAt: string
  retryCount: number
  nextRetryAt: string
}

interface CacheMetadata {
  roomId: string
  roomType: 'dm' | 'club'
  lastSyncAt: string
  messageCount: number
}

let dbPromise: Promise<IDBDatabase> | null = null

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      const oldVersion = event.oldVersion

      // Store for cached messages
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('room', ['roomType', 'roomId'], { unique: false })
        store.createIndex('cachedAt', 'cachedAt', { unique: false })
        store.createIndex('status', 'status', { unique: false })
      }

      // Store for per-room metadata (last sync time)
      if (!db.objectStoreNames.contains(META_STORE)) {
        const metaStore = db.createObjectStore(META_STORE, { keyPath: 'roomId' })
        metaStore.createIndex('roomType', 'roomType', { unique: false })
      }

      // Store for pending message queue (new in v2)
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const queueStore = db.createObjectStore(QUEUE_STORE, { keyPath: 'id' })
        queueStore.createIndex('room', ['roomType', 'roomId'], { unique: false })
        queueStore.createIndex('nextRetryAt', 'nextRetryAt', { unique: false })
      }

      // Migration: add status to existing messages
      if (oldVersion < 2 && db.objectStoreNames.contains(STORE_NAME)) {
        const store = (event.target as IDBOpenDBRequest).transaction?.objectStore(STORE_NAME)
        if (store) {
          // Existing messages get 'sent' status by default
          const cursor = store.openCursor()
          cursor.onsuccess = (e) => {
            const result = (e.target as IDBRequest).result as IDBCursorWithValue | null
            if (result) {
              const data = result.value
              if (!data.status) {
                data.status = 'sent'
                result.update(data)
              }
              result.continue()
            }
          }
        }
      }
    }
  })

  return dbPromise
}

/**
 * Cache messages for a room
 */
export async function cacheMessages(
  roomId: string,
  roomType: 'dm' | 'club',
  messages: any[]
): Promise<void> {
  try {
    const db = await getDB()
    const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const metaStore = tx.objectStore(META_STORE)

    const now = new Date().toISOString()

    // Add/update messages
    for (const msg of messages) {
      const cached: CachedMessage = {
        id: msg.id,
        roomId,
        roomType,
        data: msg,
        cachedAt: now,
        status: msg.status || 'sent',
        clientMessageId: msg.client_message_id,
      }
      await promisifyRequest(store.put(cached))
    }

    // Update metadata
    const lastMessage = messages[messages.length - 1]
    const metadata: CacheMetadata = {
      roomId,
      roomType,
      lastSyncAt: lastMessage?.created_at || now,
      messageCount: messages.length,
    }
    await promisifyRequest(metaStore.put(metadata))

    await promisifyTransaction(tx)
  } catch (err) {
    console.error('Failed to cache messages:', err)
  }
}

/**
 * Get cached messages for a room
 */
export async function getCachedMessages(
  roomId: string,
  roomType: 'dm' | 'club'
): Promise<{ messages: any[]; lastSyncAt: string | null }> {
  try {
    const db = await getDB()
    const tx = db.transaction([STORE_NAME, META_STORE], 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const metaStore = tx.objectStore(META_STORE)

    // Get metadata
    const metadata = await promisifyRequest<CacheMetadata | undefined>(metaStore.get(roomId))

    // Get messages for this room
    const index = store.index('room')
    const request = index.openCursor(IDBKeyRange.only([roomType, roomId]))

    const messages: any[] = []
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null
        if (cursor) {
          messages.push((cursor.value as CachedMessage).data)
          cursor.continue()
        } else {
          resolve()
        }
      }
      request.onerror = () => reject(request.error)
    })

    // Sort by created_at
    messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    return {
      messages,
      lastSyncAt: metadata?.lastSyncAt || null,
    }
  } catch (err) {
    console.error('Failed to get cached messages:', err)
    return { messages: [], lastSyncAt: null }
  }
}

/**
 * Update last sync timestamp for a room
 */
export async function updateLastSync(
  roomId: string,
  roomType: 'dm' | 'club',
  timestamp: string
): Promise<void> {
  try {
    const db = await getDB()
    const tx = db.transaction(META_STORE, 'readwrite')
    const metaStore = tx.objectStore(META_STORE)

    const existing = await promisifyRequest<CacheMetadata | undefined>(metaStore.get(roomId))
    const metadata: CacheMetadata = {
      roomId,
      roomType,
      lastSyncAt: timestamp,
      messageCount: existing?.messageCount || 0,
    }
    await promisifyRequest(metaStore.put(metadata))
    await promisifyTransaction(tx)
  } catch (err) {
    console.error('Failed to update last sync:', err)
  }
}

/**
 * Get last sync timestamp for a room
 */
export async function getLastSync(
  roomId: string
): Promise<string | null> {
  try {
    const db = await getDB()
    const tx = db.transaction(META_STORE, 'readonly')
    const metaStore = tx.objectStore(META_STORE)
    const metadata = await promisifyRequest<CacheMetadata | undefined>(metaStore.get(roomId))
    return metadata?.lastSyncAt || null
  } catch (err) {
    console.error('Failed to get last sync:', err)
    return null
  }
}

/**
 * Add a message to the pending queue (for offline retry)
 */
export async function addPendingMessage(
  clientMessageId: string,
  roomId: string,
  roomType: 'dm' | 'club',
  content: string,
  replyToMessageId?: string,
  mediaUrl?: string,
  mediaType?: string
): Promise<void> {
  try {
    const db = await getDB()
    const tx = db.transaction(QUEUE_STORE, 'readwrite')
    const store = tx.objectStore(QUEUE_STORE)

    const now = new Date().toISOString()
    const item: PendingQueueItem = {
      id: clientMessageId,
      roomId,
      roomType,
      content,
      replyToMessageId,
      mediaUrl,
      mediaType,
      createdAt: now,
      retryCount: 0,
      nextRetryAt: now,
    }

    await promisifyRequest(store.put(item))
    await promisifyTransaction(tx)
  } catch (err) {
    console.error('Failed to add pending message:', err)
  }
}

/**
 * Get all pending messages for a room
 */
export async function getPendingMessages(
  roomId: string,
  roomType: 'dm' | 'club'
): Promise<PendingQueueItem[]> {
  try {
    const db = await getDB()
    const tx = db.transaction(QUEUE_STORE, 'readonly')
    const store = tx.objectStore(QUEUE_STORE)
    const index = store.index('room')

    const items: PendingQueueItem[] = []
    const request = index.openCursor(IDBKeyRange.only([roomType, roomId]))

    await new Promise<void>((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null
        if (cursor) {
          items.push(cursor.value)
          cursor.continue()
        } else {
          resolve()
        }
      }
      request.onerror = () => reject(request.error)
    })

    return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  } catch (err) {
    console.error('Failed to get pending messages:', err)
    return []
  }
}

/**
 * Get all pending messages ready for retry (nextRetryAt <= now)
 */
export async function getPendingMessagesReadyForRetry(): Promise<PendingQueueItem[]> {
  try {
    const db = await getDB()
    const tx = db.transaction(QUEUE_STORE, 'readonly')
    const store = tx.objectStore(QUEUE_STORE)
    const index = store.index('nextRetryAt')

    const now = new Date().toISOString()
    const items: PendingQueueItem[] = []

    // Get all items where nextRetryAt <= now
    const request = index.openCursor(IDBKeyRange.upperBound(now))

    await new Promise<void>((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null
        if (cursor) {
          items.push(cursor.value)
          cursor.continue()
        } else {
          resolve()
        }
      }
      request.onerror = () => reject(request.error)
    })

    return items.sort((a, b) => new Date(a.nextRetryAt).getTime() - new Date(b.nextRetryAt).getTime())
  } catch (err) {
    console.error('Failed to get pending messages for retry:', err)
    return []
  }
}

/**
 * Update retry count and next retry time for a pending message
 */
export async function updatePendingMessageRetry(
  clientMessageId: string,
  retryCount: number,
  nextRetryDelayMs: number
): Promise<void> {
  try {
    const db = await getDB()
    const tx = db.transaction(QUEUE_STORE, 'readwrite')
    const store = tx.objectStore(QUEUE_STORE)

    const item = await promisifyRequest<PendingQueueItem | undefined>(store.get(clientMessageId))
    if (item) {
      item.retryCount = retryCount
      item.nextRetryAt = new Date(Date.now() + nextRetryDelayMs).toISOString()
      await promisifyRequest(store.put(item))
    }

    await promisifyTransaction(tx)
  } catch (err) {
    console.error('Failed to update pending message retry:', err)
  }
}

/**
 * Remove a message from the pending queue (after successful send)
 */
export async function removePendingMessage(clientMessageId: string): Promise<void> {
  try {
    const db = await getDB()
    const tx = db.transaction(QUEUE_STORE, 'readwrite')
    const store = tx.objectStore(QUEUE_STORE)

    await promisifyRequest(store.delete(clientMessageId))
    await promisifyTransaction(tx)
  } catch (err) {
    console.error('Failed to remove pending message:', err)
  }
}

/**
 * Update message status in cache
 */
export async function updateMessageStatus(
  messageId: string,
  status: MessageStatus,
  retryCount?: number,
  lastRetryAt?: string
): Promise<void> {
  try {
    const db = await getDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    const item = await promisifyRequest<CachedMessage | undefined>(store.get(messageId))
    if (item) {
      item.status = status
      if (retryCount !== undefined) item.retryCount = retryCount
      if (lastRetryAt) item.lastRetryAt = lastRetryAt
      await promisifyRequest(store.put(item))
    }

    await promisifyTransaction(tx)
  } catch (err) {
    console.error('Failed to update message status:', err)
  }
}

/**
 * Clear cache for a room (e.g., when leaving room)
 */
export async function clearRoomCache(roomId: string, roomType: 'dm' | 'club'): Promise<void> {
  try {
    const db = await getDB()

    // Clear messages
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('room')

    const request = index.openCursor(IDBKeyRange.only([roomType, roomId]))
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursor | null
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }
      request.onerror = () => reject(request.error)
    })

    // Clear pending queue for this room
    const queueTx = db.transaction(QUEUE_STORE, 'readwrite')
    const queueStore = queueTx.objectStore(QUEUE_STORE)
    const queueIndex = queueStore.index('room')

    const queueRequest = queueIndex.openCursor(IDBKeyRange.only([roomType, roomId]))
    await new Promise<void>((resolve, reject) => {
      queueRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursor | null
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }
      queueRequest.onerror = () => reject(queueRequest.error)
    })

    // Also clear metadata
    const metaTx = db.transaction(META_STORE, 'readwrite')
    const metaStore = metaTx.objectStore(META_STORE)
    await promisifyRequest(metaStore.delete(roomId))

    await Promise.all([
      promisifyTransaction(tx),
      promisifyTransaction(queueTx),
      promisifyTransaction(metaTx),
    ])
  } catch (err) {
    console.error('Failed to clear room cache:', err)
  }
}

/**
 * Clear all cached data (e.g., on logout)
 */
export async function clearAllCache(): Promise<void> {
  try {
    const db = await getDB()
    const tx = db.transaction([STORE_NAME, META_STORE, QUEUE_STORE], 'readwrite')
    await promisifyRequest(tx.objectStore(STORE_NAME).clear())
    await promisifyRequest(tx.objectStore(META_STORE).clear())
    await promisifyRequest(tx.objectStore(QUEUE_STORE).clear())
    await promisifyTransaction(tx)
  } catch (err) {
    console.error('Failed to clear cache:', err)
  }
}

// Helper functions
function promisifyRequest<T>(request: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T)
    request.onerror = () => reject(request.error)
  })
}

function promisifyTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(new Error('Transaction aborted'))
  })
}
