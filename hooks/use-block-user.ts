'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface BlockedUser {
  id: string
  blocked_id: string
  created_at: string
  blocked_user: {
    id: string
    username: string
    avatar_url?: string
  }
}

export interface BlockCheckResult {
  hasBlocked: boolean
  isBlockedBy: boolean
  canInteract: boolean
}

export function useBlockUser() {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch list of blocked users
  const fetchBlockedUsers = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/blocks')
      if (!response.ok) {
        throw new Error('Failed to fetch blocked users')
      }
      const data = await response.json()
      setBlockedUsers(data.blocks || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Block a user
  const blockUser = useCallback(async (userId: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked_id: userId }),
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to block user')
      }
      
      const data = await response.json()
      setBlockedUsers(prev => [data.block, ...prev])
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Unblock a user
  const unblockUser = useCallback(async (userId: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/blocks/${userId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error('Failed to unblock user')
      }
      
      setBlockedUsers(prev => prev.filter(b => b.blocked_id !== userId))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Check block status with a specific user
  const checkBlockStatus = useCallback(async (userId: string): Promise<BlockCheckResult> => {
    try {
      const response = await fetch(`/api/blocks/check/${userId}`)
      if (!response.ok) {
        return { hasBlocked: false, isBlockedBy: false, canInteract: true }
      }
      return await response.json()
    } catch {
      return { hasBlocked: false, isBlockedBy: false, canInteract: true }
    }
  }, [])

  // Check if a user is in blocked list (local check)
  const isBlocked = useCallback((userId: string): boolean => {
    return blockedUsers.some(b => b.blocked_id === userId)
  }, [blockedUsers])

  return {
    blockedUsers,
    isLoading,
    error,
    fetchBlockedUsers,
    blockUser,
    unblockUser,
    checkBlockStatus,
    isBlocked,
  }
}

// Hook for checking block status with realtime updates
export function useBlockStatus(userId: string | null) {
  const [status, setStatus] = useState<BlockCheckResult>({
    hasBlocked: false,
    isBlockedBy: false,
    canInteract: true,
  })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!userId) return

    const checkStatus = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/blocks/check/${userId}`)
        if (response.ok) {
          const data = await response.json()
          setStatus(data)
        }
      } finally {
        setIsLoading(false)
      }
    }

    checkStatus()

    // Subscribe to realtime changes
    const supabase = createClient()
    const channel = supabase
      .channel(`block-status-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_blocks',
        },
        () => {
          checkStatus()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  return { status, isLoading }
}
