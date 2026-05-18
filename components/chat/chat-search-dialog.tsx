'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Loader2, Search } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'

interface SearchResult {
  id: string
  content: string
  created_at: string
  users?: { username: string }
}

interface ChatSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roomType: 'dm' | 'club'
  roomId: string
  onSelectMessage: (messageId: string) => void
}

export function ChatSearchDialog({
  open,
  onOpenChange,
  roomType,
  roomId,
  onSelectMessage,
}: ChatSearchDialogProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const apiBase = roomType === 'dm' ? `/api/dm/rooms/${roomId}` : `/api/club/${roomId}`

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(
        `${apiBase}/messages?search=${encodeURIComponent(q)}&limit=30`
      )
      if (res.ok) {
        const data = await res.json()
        setResults(data.messages || [])
      }
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [apiBase])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      return
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => search(query), 300)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [query, open, search])

  const handleSelect = (messageId: string) => {
    onSelectMessage(messageId)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tìm kiếm trong đoạn chat</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Nhập từ khóa..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {searching && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!searching && query.length >= 2 && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Không tìm thấy tin nhắn
            </p>
          )}
          {results.map((msg) => (
            <button
              key={msg.id}
              type="button"
              onClick={() => handleSelect(msg.id)}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors"
            >
              <p className="text-xs text-muted-foreground mb-0.5">
                {msg.users?.username} ·{' '}
                {formatDistanceToNow(new Date(msg.created_at), {
                  addSuffix: true,
                  locale: vi,
                })}
              </p>
              <p className="text-sm line-clamp-2">{msg.content}</p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
