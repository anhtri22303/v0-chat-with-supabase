'use client'

import { useState, useEffect } from 'react'
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
}

export function CreateGroupModal({ dmRooms, onGroupCreated }: CreateGroupModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

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
      toast.error('Group name is required')
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
      toast.success('Group created successfully!')
      setGroupName('')
      setDescription('')
      setSelectedMembers([])
      setOpen(false)
      onGroupCreated?.()
      router.push(`/clubs/${club.id}`)
    } catch (error) {
      console.error('Error creating group:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to create group'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">Create Group</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
          <DialogDescription>
            Create a new group chat and invite members from your conversations.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateGroup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Group Name</Label>
            <Input
              id="group-name"
              placeholder="My Awesome Group"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="What's this group about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Add Members from Your Conversations</Label>
            {dmRooms.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                You don&apos;t have any direct messages yet. Start a conversation first to add members to your group.
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
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !groupName.trim()}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Group
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
