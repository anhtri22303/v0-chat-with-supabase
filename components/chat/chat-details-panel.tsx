'use client'

import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { ChatDetailsContent, type ChatDetailsContentProps } from './chat-details-content'

interface ChatDetailsPanelProps extends Omit<ChatDetailsContentProps, 'variant'> {
  onClose: () => void
}

export function ChatDetailsPanel({ onClose, ...props }: ChatDetailsPanelProps) {
  return (
    <aside className="flex flex-col h-full w-[360px] border-l bg-background shrink-0">
      <div className="flex items-center justify-end px-2 py-2 border-b shrink-0">
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Đóng">
          <X className="h-5 w-5" />
        </Button>
      </div>
      <ChatDetailsContent {...props} variant="panel" />
    </aside>
  )
}
