'use client'

import { useTranslations } from 'next-intl'
import { ChatLayout } from '@/components/layout/chat-layout'
import { MessageSquare } from 'lucide-react'

export default function Dashboard() {
  const t = useTranslations('dashboard')

  return (
    <ChatLayout>
      <div className="flex-1 hidden md:flex flex-col h-full bg-card/10 text-muted-foreground p-8">
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <MessageSquare className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground mb-2">{t('title')}</h2>
          <p className="max-w-md">{t('subtitle')}</p>
        </div>
      </div>
    </ChatLayout>
  )
}
