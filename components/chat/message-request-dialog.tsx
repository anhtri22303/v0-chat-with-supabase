'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { useNotifications } from '@/contexts/notification-context'

interface MessageRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  requestId: string
  roomId: string
  sender: {
    id: string
    username: string
    avatar_url: string | null
  }
  onAccepted?: () => void
}

export function MessageRequestDialog({
  open,
  onOpenChange,
  requestId,
  roomId,
  sender,
  onAccepted,
}: MessageRequestDialogProps) {
  const t = useTranslations('messageRequestDialog')
  const locale = useLocale()
  const router = useRouter()
  const { refreshMessageRequestCount } = useNotifications()
  const [isProcessing, setIsProcessing] = useState(false)

  const handleAccept = async () => {
    setIsProcessing(true)
    try {
      const response = await fetch(`/api/message-requests/${requestId}/accept`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to accept')
      
      toast.success(t('accept'))
      await refreshMessageRequestCount()
      onOpenChange(false)
      onAccepted?.()
    } catch (error) {
      console.error('Error accepting request:', error)
      toast.error('Failed to accept message request')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSpam = async () => {
    setIsProcessing(true)
    try {
      const response = await fetch(`/api/message-requests/${requestId}/spam`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to mark as spam')
      
      toast.success(t('spam'))
      await refreshMessageRequestCount()
      onOpenChange(false)
      router.push(`/${locale}/message-requests`)
    } catch (error) {
      console.error('Error marking as spam:', error)
      toast.error('Failed to mark as spam')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDelete = async () => {
    setIsProcessing(true)
    try {
      const response = await fetch(`/api/message-requests/${requestId}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete')
      
      toast.success('Deleted')
      await refreshMessageRequestCount()
      onOpenChange(false)
      router.push(`/${locale}/message-requests`)
    } catch (error) {
      console.error('Error deleting request:', error)
      toast.error('Failed to delete message request')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={sender?.avatar_url || undefined} alt={sender?.username} />
              <AvatarFallback className="text-2xl">
                {sender?.username?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
          </div>
          <DialogTitle className="text-center">{t('title')}</DialogTitle>
          <DialogDescription className="text-center">
            {t('description', { name: sender?.username || 'Unknown' })}
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground text-center">
          {t('info')}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button 
            onClick={handleAccept} 
            disabled={isProcessing}
            className="w-full"
          >
            {t('accept')}
          </Button>
          <div className="flex gap-2 w-full">
            <Button 
              variant="outline" 
              onClick={handleSpam} 
              disabled={isProcessing}
              className="flex-1"
            >
              {t('spam')}
            </Button>
            <Button 
              variant="ghost" 
              onClick={handleDelete} 
              disabled={isProcessing}
              className="flex-1 text-destructive hover:text-destructive"
            >
              {t('block')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
