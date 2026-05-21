'use client'

import { login, signInWithGoogle, signInWithFacebook } from '@/app/auth/actions'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FormEvent, Suspense, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('auth')
  const locale = useLocale()
  const error = searchParams.get('error_description')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isFacebookLoading, setIsFacebookLoading] = useState(false)

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

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true)
    await signInWithGoogle(locale)
  }

  const handleFacebookSignIn = async () => {
    setIsFacebookLoading(true)
    await signInWithFacebook(locale)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <Image
              src="/Logo_ChaTChiT.svg"
              alt="ChaTChiT"
              width={80}
              height={80}
              className="rounded-xl"
              priority
            />
          </div>
          <CardTitle className="text-2xl text-center">{t('loginTitle')}</CardTitle>
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

            <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading || isFacebookLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('signInLoading')}
                </>
              ) : (
                t('signIn')
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">{t('orContinueWith')}</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={isLoading || isGoogleLoading || isFacebookLoading}
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('googleSignInLoading')}
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  {t('continueWithGoogle')}
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleFacebookSignIn}
              disabled={isLoading || isGoogleLoading || isFacebookLoading}
            >
              {isFacebookLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('facebookSignInLoading')}
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" aria-hidden="true" fill="#1877F2">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  {t('continueWithFacebook')}
                </>
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
