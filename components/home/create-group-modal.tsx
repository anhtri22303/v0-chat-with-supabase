'use client'

import { useState, useEffect } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface DMRoom {
  id: string
  name: string
  participant: {
    id: string
    username: string
  }
}

interface CreateGroupModalProps {
  dmRooms: DMRoom[]
  onGroupCreated?: () => void
  initialMemberIds?: string[]
  defaultOpen?: boolean
  triggerLabel?: string
  triggerVariant?: 'default' | 'outline' | 'ghost' | 'secondary'
  triggerClassName?: string
  hideTrigger?: boolean
}

export function CreateGroupModal({
  dmRooms,
  onGroupCreated,
  initialMemberIds = [],
  defaultOpen = false,
  triggerLabel,
  triggerVariant = 'default',
  triggerClassName,
  hideTrigger = false,
}: CreateGroupModalProps) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('createGroup')
  const [open, setOpen] = useState(defaultOpen)
  const [groupName, setGroupName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>(initialMemberIds)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (initialMemberIds.length > 0) {
      setSelectedMembers(initialMemberIds)
    }
  }, [initialMemberIds])

  const handleToggleMember = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    )
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!groupName.trim()) {
      toast.error(t('errorNameRequired'))
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName,
          description: description || null,
          memberIds: selectedMembers,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create group')
      }

      const { club } = await response.json()
      toast.success(t('success'))
      setGroupName('')
      setDescription('')
      setSelectedMembers([])
      setOpen(false)
      onGroupCreated?.()
      router.push(`/${locale}/clubs/${club.id}`)
    } catch (error) {
      console.error('Error creating group:', error)
      toast.error(
        error instanceof Error ? error.message : t('errorCreate')
      )
    } finally {
      setIsLoading(false)
    }
  }

  const resolvedTriggerLabel = triggerLabel || t('trigger')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant={triggerVariant} className={triggerClassName || 'w-full'}>
            {resolvedTriggerLabel}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateGroup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">{t('nameLabel')}</Label>
            <Input
              id="group-name"
              placeholder={t('namePlaceholder')}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('descriptionLabel')}</Label>
            <Textarea
              id="description"
              placeholder={t('descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('addMembers')}</Label>
            {dmRooms.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                {t('noDm')}
              </p>
            ) : (
              <div className="border rounded-lg p-3 space-y-3 max-h-48 overflow-y-auto">
                {dmRooms.map((room) => (
                  <div key={room.id} className="flex items-center gap-3">
                    <Checkbox
                      id={room.id}
                      checked={selectedMembers.includes(
                        room.participant.id
                      )}
                      onCheckedChange={() =>
                        handleToggleMember(room.participant.id)
                      }
                      disabled={isLoading}
                    />
                    <label
                      htmlFor={room.id}
                      className="text-sm font-medium cursor-pointer flex-1"
                    >
                      {room.participant.username}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isLoading || !groupName.trim()}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
