'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Check, Trash2, AlertTriangle, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { useNotifications } from '@/contexts/notification-context'
import { formatDistanceToNow } from 'date-fns'
import { vi, enUS } from 'date-fns/locale'

interface MessageRequest {
  id: string
  room_id: string
  sender_id: string
  sender: {
    id: string
    username: string
    avatar_url: string | null
  }
  status: 'new' | 'spam' | 'accepted' | 'deleted'
  first_message_at: string
  last_message: string
  last_message_time: string
}

export default function MessageRequestsPage() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('messageRequests')
  const { refreshMessageRequestCount } = useNotifications()
  const [activeTab, setActiveTab] = useState('new')
  const [requests, setRequests] = useState<MessageRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchRequests(activeTab as 'new' | 'spam')
  }, [activeTab])

  const fetchRequests = async (status: 'new' | 'spam') => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/message-requests?status=${status}`)
      if (!response.ok) throw new Error('Failed to fetch')
      const data = await response.json()
      setRequests(data.requests || [])
    } catch (error) {
      console.error('Error fetching message requests:', error)
      toast.error(t('fetchError'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleAccept = async (requestId: string, roomId: string) => {
    setProcessingIds(prev => new Set(prev).add(requestId))
    try {
      const response = await fetch(`/api/message-requests/${requestId}/accept`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to accept')
      
      toast.success(t('acceptSuccess'))
      await fetchRequests(activeTab as 'new' | 'spam')
      await refreshMessageRequestCount()
      
      // Navigate to the chat
      router.push(`/${locale}/dm/${roomId}`)
    } catch (error) {
      console.error('Error accepting request:', error)
      toast.error(t('acceptError'))
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(requestId)
        return newSet
      })
    }
  }

  const handleMarkAsSpam = async (requestId: string) => {
    setProcessingIds(prev => new Set(prev).add(requestId))
    try {
      const response = await fetch(`/api/message-requests/${requestId}/spam`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to mark as spam')
      
      toast.success(t('spamSuccess'))
      await fetchRequests(activeTab as 'new' | 'spam')
      await refreshMessageRequestCount()
    } catch (error) {
      console.error('Error marking as spam:', error)
      toast.error(t('spamError'))
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(requestId)
        return newSet
      })
    }
  }

  const handleDelete = async (requestId: string) => {
    setProcessingIds(prev => new Set(prev).add(requestId))
    try {
      const response = await fetch(`/api/message-requests/${requestId}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete')
      
      toast.success(t('deleteSuccess'))
      await fetchRequests(activeTab as 'new' | 'spam')
      await refreshMessageRequestCount()
    } catch (error) {
      console.error('Error deleting request:', error)
      toast.error(t('deleteError'))
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(requestId)
        return newSet
      })
    }
  }

  const localeObj = locale === 'vi' ? vi : enUS

  const RequestCard = ({ request }: { request: MessageRequest }) => {
    const isProcessing = processingIds.has(request.id)
    const isSpam = request.status === 'spam'

    return (
      <div className="flex items-start gap-3 p-4 hover:bg-accent/50 transition-colors border-b last:border-b-0">
        <Avatar className="h-12 w-12 flex-shrink-0">
          <AvatarImage src={request.sender?.avatar_url || undefined} alt={request.sender?.username} />
          <AvatarFallback className="text-lg">
            {request.sender?.username?.[0]?.toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold truncate">{request.sender?.username || t('unknown')}</h3>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {formatDistanceToNow(new Date(request.last_message_time), { addSuffix: true, locale: localeObj })}
            </span>
          </div>
          
          <p className="text-sm text-muted-foreground truncate mt-1">
            {request.last_message || t('noMessage')}
          </p>
          
          <div className="flex items-center gap-2 mt-3">
            {!isSpam ? (
              <>
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 text-xs"
                  disabled={isProcessing}
                  onClick={() => handleAccept(request.id, request.room_id)}
                >
                  <Check className="h-3 w-3 mr-1" />
                  {t('accept')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  disabled={isProcessing}
                  onClick={() => handleMarkAsSpam(request.id)}
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {t('markAsSpam')}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={isProcessing}
                onClick={() => handleAccept(request.id, request.room_id)}
              >
                <Check className="h-3 w-3 mr-1" />
                {t('notSpam')}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-destructive hover:text-destructive"
              disabled={isProcessing}
              onClick={() => handleDelete(request.id)}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              {t('delete')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-card">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/${locale}/dashboard`)}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">{t('title')}</h1>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-muted/50 border-b">
        <p className="text-sm text-muted-foreground">
          {t('infoText')}
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-4 grid w-auto grid-cols-2">
          <TabsTrigger value="new" className="relative">
            {t('tabNew')}
            <Badge 
              variant="destructive" 
              className="ml-2 h-5 min-w-5 px-1 text-[10px]"
            >
              0
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="spam">{t('tabSpam')}</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="flex-1 m-0 mt-4">
          <ScrollArea className="h-[calc(100vh-200px)]">
            {isLoading ? (
              <div className="space-y-1">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-4 border-b">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">{t('noNewRequests')}</p>
              </div>
            ) : (
              <div className="divide-y">
                {requests.map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="spam" className="flex-1 m-0 mt-4">
          <ScrollArea className="h-[calc(100vh-200px)]">
            {isLoading ? (
              <div className="space-y-1">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-4 border-b">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertTriangle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">{t('noSpamRequests')}</p>
              </div>
            ) : (
              <div className="divide-y">
                {requests.map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
