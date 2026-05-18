'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2, Search, X } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface User {
  id: string
  username: string
  avatar_url?: string
}

interface UserSearchProps {
  onUserSelected: (userId: string, username: string) => void
  isLoading?: boolean
}

export function UserSearch({ onUserSelected, isLoading }: UserSearchProps) {
  const t = useTranslations('userSearch')
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const searchUsers = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setUsers([])
      return
    }

    setSearching(true)
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Error searching users:', error)
      setUsers([])
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (searchQuery.length < 2) {
      setUsers([])
      return
    }

    setSearching(true)
    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(searchQuery)
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, searchUsers])

  const handleSelectUser = (userId: string, username: string) => {
    onUserSelected(userId, username)
    setSearchQuery('')
    setUsers([])
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2">
          <Search className="h-4 w-4" />
          <span>{t('startConversation')}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 outline-0 ring-0 focus-visible:ring-0 focus-visible:outline-0"
              disabled={isLoading}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <CommandList>
            {searching && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}

            {!searching && users.length === 0 && searchQuery && (
              <CommandEmpty>{t('noUsers')}</CommandEmpty>
            )}

            {!searching && users.length === 0 && !searchQuery && (
              <CommandEmpty>{t('startTyping')}</CommandEmpty>
            )}

            {!searching && users.length > 0 && (
              <CommandGroup>
                {users.map((user) => (
                  <CommandItem
                    key={user.id}
                    value={user.id}
                    onSelect={() => handleSelectUser(user.id, user.username)}
                    className="cursor-pointer"
                  >
                    <div className="flex w-full items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{user.username}</span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          handleSelectUser(user.id, user.username)
                        }}
                      >
                        {t('add')}
                      </Button>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
