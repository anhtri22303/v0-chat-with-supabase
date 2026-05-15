'use client'

import { signUp } from '@/app/auth/actions'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function SignUp() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isDuplicateEmail, setIsDuplicateEmail] = useState(false)

  useEffect(() => {
    if (isDuplicateEmail) {
      toast.error('This email is already registered. Redirecting to sign in...', {
        duration: 3000,
      })
      const timeout = setTimeout(() => {
        router.push('/auth/login')
      }, 2000)
      return () => clearTimeout(timeout)
    }
  }, [isDuplicateEmail, router])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsDuplicateEmail(false)
    const formData = new FormData(e.currentTarget)
    const result = await signUp(formData)

    if (result?.error) {
      const isDuplicate = (result.error as any)?.isDuplicateEmail
      if (isDuplicate) {
        setIsDuplicateEmail(true)
        setError(result.error.message)
      } else {
        setError(result.error.message)
      }
      return
    }

    router.push('/dashboard')
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

            <Button type="submit" className="w-full">
              Sign Up
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
