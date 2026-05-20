'use client'

import { useState, useEffect } from 'react'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Bell, BellOff, Clock, Loader2 } from 'lucide-react'
import { useMuteNotifications, type MuteDuration, type MuteInfo } from '@/hooks/use-mute-notifications'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface MuteNotificationsDialogProps {
  roomId: string
  roomType: 'dm' | 'club'
  roomName: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onMuted?: () => void
  onUnmuted?: () => void
  currentStatus?: MuteInfo
}

const DURATION_OPTIONS: { value: MuteDuration; labelKey: string; icon: React.ReactNode }[] = [
  { value: '15m', labelKey: 'for15Minutes', icon: <Clock className="h-4 w-4" /> },
  { value: '1h', labelKey: 'for1Hour', icon: <Clock className="h-4 w-4" /> },
  { value: '8h', labelKey: 'for8Hours', icon: <Clock className="h-4 w-4" /> },
  { value: '24h', labelKey: 'for24Hours', icon: <Clock className="h-4 w-4" /> },
  { value: 'indefinite', labelKey: 'untilTurnOn', icon: <BellOff className="h-4 w-4" /> },
]

export function MuteNotificationsDialog({
  roomId,
  roomType,
  roomName,
  isOpen,
  onOpenChange,
  onMuted,
  onUnmuted,
  currentStatus,
}: MuteNotificationsDialogProps) {
  const t = useTranslations('chatDetails')
  const { muteRoom, unmuteRoom, isLoading } = useMuteNotifications()
  const [selectedDuration, setSelectedDuration] = useState<MuteDuration>('indefinite')
  const [isProcessing, setIsProcessing] = useState(false)

  const isCurrentlyMuted = currentStatus?.is_muted ?? false

  // Reset selection when dialog opens
  useEffect(() => {
    if (isOpen && !isCurrentlyMuted) {
      setSelectedDuration('indefinite')
    }
  }, [isOpen, isCurrentlyMuted])

  const handleMute = async () => {
    setIsProcessing(true)
    const success = await muteRoom(roomId, roomType, selectedDuration)
    setIsProcessing(false)
    
    if (success) {
      toast.success(t('muteSuccess', { name: roomName }))
      onMuted?.()
      onOpenChange(false)
    } else {
      toast.error(t('muteFailed'))
    }
  }

  const handleUnmute = async () => {
    setIsProcessing(true)
    const success = await unmuteRoom(roomId, roomType)
    setIsProcessing(false)
    
    if (success) {
      toast.success(t('unmuteSuccess', { name: roomName }))
      onUnmuted?.()
      onOpenChange(false)
    } else {
      toast.error(t('unmuteFailed'))
    }
  }

  const formatRemainingTime = (timeRemaining: string | null): string => {
    if (!timeRemaining) return ''
    if (timeRemaining === 'indefinite') return t('mutedIndefinitely')
    return t('mutedUntil', { time: timeRemaining })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCurrentlyMuted ? (
              <>
                <Bell className="h-5 w-5 text-primary" />
                {t('unmuteNotifications')}
              </>
            ) : (
              <>
                <BellOff className="h-5 w-5 text-muted-foreground" />
                {t('muteNotifications')}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isCurrentlyMuted
              ? t('unmuteDesc', { name: roomName })
              : t('muteDesc', { name: roomName })}
          </DialogDescription>
        </DialogHeader>

        {isCurrentlyMuted && currentStatus?.time_remaining && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
            {formatRemainingTime(currentStatus.time_remaining)}
          </div>
        )}

        {!isCurrentlyMuted && (
          <div className="space-y-4 py-4">
            <RadioGroup
              value={selectedDuration}
              onValueChange={(value) => setSelectedDuration(value as MuteDuration)}
              className="space-y-3"
            >
              {DURATION_OPTIONS.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    'flex items-center space-x-3 rounded-lg border p-3 transition-colors cursor-pointer',
                    selectedDuration === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent'
                  )}
                  onClick={() => setSelectedDuration(option.value)}
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <div className="flex items-center gap-2 flex-1">
                    {option.icon}
                    <Label
                      htmlFor={option.value}
                      className="flex-1 cursor-pointer font-normal"
                    >
                      {t(option.labelKey)}
                    </Label>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing || isLoading}
          >
            {t('cancel')}
          </Button>
          
          {isCurrentlyMuted ? (
            <Button
              onClick={handleUnmute}
              disabled={isProcessing || isLoading}
              className="gap-2"
            >
              {(isProcessing || isLoading) && <Loader2 className="h-4 w-4 animate-spin" />}
              <Bell className="h-4 w-4" />
              {t('unmute')}
            </Button>
          ) : (
            <Button
              onClick={handleMute}
              disabled={isProcessing || isLoading}
              variant="secondary"
              className="gap-2"
            >
              {(isProcessing || isLoading) && <Loader2 className="h-4 w-4 animate-spin" />}
              <BellOff className="h-4 w-4" />
              {t('mute')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
