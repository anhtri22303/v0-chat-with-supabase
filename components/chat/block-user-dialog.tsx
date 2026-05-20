'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Shield, ShieldOff, Loader2 } from 'lucide-react'
import { useBlockUser } from '@/hooks/use-block-user'
import { toast } from 'sonner'

interface BlockUserDialogProps {
  userId: string
  userName: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onBlocked?: () => void
  onUnblocked?: () => void
  initialBlocked?: boolean
}

export function BlockUserDialog({
  userId,
  userName,
  isOpen,
  onOpenChange,
  onBlocked,
  onUnblocked,
  initialBlocked = false,
}: BlockUserDialogProps) {
  const t = useTranslations('chatDetails')
  const [isBlocked, setIsBlocked] = useState(initialBlocked)
  const [isProcessing, setIsProcessing] = useState(false)
  const { blockUser, unblockUser } = useBlockUser()

  const handleBlock = async () => {
    setIsProcessing(true)
    const success = await blockUser(userId)
    setIsProcessing(false)
    
    if (success) {
      setIsBlocked(true)
      toast.success(t('blockSuccess', { name: userName }))
      onBlocked?.()
      onOpenChange(false)
    } else {
      toast.error(t('blockFailed'))
    }
  }

  const handleUnblock = async () => {
    setIsProcessing(true)
    const success = await unblockUser(userId)
    setIsProcessing(false)
    
    if (success) {
      setIsBlocked(false)
      toast.success(t('unblockSuccess', { name: userName }))
      onUnblocked?.()
      onOpenChange(false)
    } else {
      toast.error(t('unblockFailed'))
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isBlocked ? (
              <>
                <ShieldOff className="h-5 w-5 text-muted-foreground" />
                {t('unblockUser')}
              </>
            ) : (
              <>
                <Shield className="h-5 w-5 text-destructive" />
                {t('blockUser')}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isBlocked
              ? t('unblockConfirmDesc', { name: userName })
              : t('blockConfirmDesc', { name: userName })}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            {t('cancel')}
          </Button>
          
          {isBlocked ? (
            <Button
              onClick={handleUnblock}
              disabled={isProcessing}
              className="gap-2"
            >
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('unblock')}
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={handleBlock}
              disabled={isProcessing}
              className="gap-2"
            >
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('block')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
