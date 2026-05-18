'use client'

import { signUp } from '@/app/auth/actions'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import emailjs from '@emailjs/browser'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function SignUp() {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('auth')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Check for persisted duplicate email notification
    const duplicateEmailNotif = localStorage.getItem('duplicateEmailNotif')
    if (duplicateEmailNotif) {
      toast.error(t('duplicateEmail'), {
        duration: 4000,
      })
      localStorage.removeItem('duplicateEmailNotif')
    }
  }, [t])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    formData.set('origin', window.location.origin)
    const email = String(formData.get('email') ?? '')
    const username = String(formData.get('username') ?? '')
    const result = await signUp(formData)

    if (result?.error) {
      const isDuplicate = (result.error as any)?.isDuplicateEmail
      if (isDuplicate) {
        // Persist notification across navigation
        localStorage.setItem('duplicateEmailNotif', 'true')
        setIsLoading(false)
        router.push(`/${locale}/auth/login`)
      } else {
        const messageKey = result.error.message as string
        setError(t(messageKey, { default: t('signUpFailed') }))
        setIsLoading(false)
      }
      return
    }

    if (result?.usedAdminSignup) {
      const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID ?? ''
      const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID ?? ''
      const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY ?? ''
      const confirmLink = (result as any)?.confirmLink as string | undefined

      if (serviceId && templateId && publicKey && confirmLink) {
        try {
          await emailjs.send(
            serviceId,
            templateId,
            {
              email,
              username,
              confirm_url: confirmLink,
              url: confirmLink,
            },
            publicKey,
          )
          toast.success(t('confirmEmailSent'))
        } catch (sendError) {
          console.error('EmailJS send error:', sendError)
          setError(t('confirmEmailError'))
          setIsLoading(false)
          return
        }
      } else {
        toast.error(t('confirmEmailMissingConfig'))
        setIsLoading(false)
        return
      }

      setIsLoading(false)
      router.push(`/${locale}/auth/login`)
      return
    }

    toast.success(t('checkEmailConfirm'))
    router.push(`/${locale}/auth/login`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t('createAccount')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder={t('emailPlaceholder')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">{t('username')}</Label>
              <Input
                id="username"
                name="username"
                placeholder={t('usernamePlaceholder')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                name="password"
                placeholder={t('passwordPlaceholder')}
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('signUpLoading')}
                </>
              ) : (
                t('signUp')
              )}
            </Button>

            <p className="text-center text-sm">
              {t('haveAccount')}{' '}
              <Link href={`/${locale}/auth/login`} className="text-primary hover:underline">
                {t('loginLink')}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
