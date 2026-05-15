'use client'

import { signUp } from '@/app/auth/actions'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import emailjs from '@emailjs/browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function SignUp() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Check for persisted duplicate email notification
    const duplicateEmailNotif = localStorage.getItem('duplicateEmailNotif')
    if (duplicateEmailNotif) {
      toast.error('This email is already registered. Please sign in instead.', {
        duration: 4000,
      })
      localStorage.removeItem('duplicateEmailNotif')
    }
  }, [])

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
        router.push('/auth/login')
      } else {
        setError(result.error.message)
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
          toast.success('Confirmation email sent. Please check your inbox.')
        } catch (sendError) {
          console.error('EmailJS send error:', sendError)
          setError('Failed to send confirmation email. Please try again.')
          setIsLoading(false)
          return
        }
      } else {
        toast.error('Missing EmailJS configuration for confirmation email.')
        setIsLoading(false)
        return
      }

      setIsLoading(false)
      router.push('/auth/login')
      return
    }

    toast.success('Please check your email to confirm your account.')
    router.push('/auth/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Create Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                placeholder="Your name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                name="password"
                placeholder="••••••••"
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Sign Up'
              )}
            </Button>

            <p className="text-center text-sm">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-primary hover:underline">
                Log in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
