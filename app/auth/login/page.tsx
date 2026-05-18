'use client'

import { login } from '@/app/auth/actions'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FormEvent, Suspense, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('auth')
  const locale = useLocale()
  const error = searchParams.get('error_description')
  const [loginError, setLoginError] = useState<string | null>(null)
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
    setLoginError(null)
    setIsLoading(true)
    const formData = new FormData(e.currentTarget)
    const result = await login(formData)

    if (result?.error) {
      const messageKey = result.error.message as string
      setLoginError(t(messageKey, { default: t('loginFailed') }))
      setIsLoading(false)
      return
    }

    router.push(`/${locale}/dashboard`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{t('loginTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            {loginError && <p className="text-sm text-destructive">{loginError}</p>}

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
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                name="password"
                placeholder={t('passwordPlaceholder')}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('signInLoading')}
                </>
              ) : (
                t('signIn')
              )}
            </Button>

            <p className="text-center text-sm">
              {t('noAccount')}{' '}
              <Link href={`/${locale}/auth/sign-up`} className="text-primary hover:underline">
                {t('signUpLink')}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function Login() {
  const t = useTranslations('auth')

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" aria-label={t('signInLoading')} />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
