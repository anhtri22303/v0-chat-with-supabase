'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Phone, PhoneOff, Video } from 'lucide-react'
import type { CallSession } from '@/lib/call-types'
import { useEffect, useRef } from 'react'
import { startRingtone, type RingtoneHandle } from '@/lib/ringtone'
import { getRingtone, getRingtoneUrl } from '@/lib/call-preferences'
import { useTranslations } from 'next-intl'

interface IncomingCallDialogProps {
  session: CallSession | null
  callerName: string
  callerAvatar?: string | null
  open: boolean
  onAccept: () => void
  onDecline: () => void
  isJoining?: boolean
}

export function IncomingCallDialog({
  session,
  callerName,
  callerAvatar,
  open,
  onAccept,
  onDecline,
  isJoining,
}: IncomingCallDialogProps) {
  const t = useTranslations('call')
  const ringtoneRef = useRef<RingtoneHandle | null>(null)
  const sessionId = session?.id

  useEffect(() => {
    if (!open || !sessionId) {
      ringtoneRef.current?.stop()
      ringtoneRef.current = null
      return
    }

    ringtoneRef.current?.stop()
    const soundUrl = getRingtoneUrl(getRingtone())
    ringtoneRef.current = startRingtone(0.18, soundUrl)

    return () => {
      ringtoneRef.current?.stop()
      ringtoneRef.current = null
    }
  }, [open, sessionId])

  if (!session) return null

  const handleAccept = () => {
    ringtoneRef.current?.stop()
    ringtoneRef.current = null
    onAccept()
  }

  const handleDecline = () => {
    ringtoneRef.current?.stop()
    ringtoneRef.current = null
    onDecline()
  }

  const isVideo = session.call_type === 'video'
  const isClub = session.room_type === 'club'

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-sm"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="items-center text-center">
          <Avatar className="h-20 w-20 mb-2">
            <AvatarImage src={callerAvatar || undefined} />
            <AvatarFallback>{callerName[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <DialogTitle>{callerName}</DialogTitle>
          <DialogDescription>
            {isClub
              ? isVideo
                ? t('incomingGroupVideo')
                : t('incomingGroupAudio')
              : isVideo
                ? t('incomingVideo')
                : t('incomingAudio')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center gap-6 pt-4">
          <Button
            variant="destructive"
            size="icon"
            className="h-14 w-14 rounded-full"
            onClick={handleDecline}
            disabled={isJoining}
            aria-label={t('decline')}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
          <Button
            size="icon"
            className="h-14 w-14 rounded-full bg-green-600 hover:bg-green-700"
            onClick={handleAccept}
            disabled={isJoining}
            aria-label={t('accept')}
          >
            {isVideo ? (
              <Video className="h-6 w-6" />
            ) : (
              <Phone className="h-6 w-6" />
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
