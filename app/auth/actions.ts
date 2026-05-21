'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

async function getSiteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }
  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const proto = headersList.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

export async function signUp(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const username = formData.get('username') as string
  const origin = String(formData.get('origin') ?? '')
  const baseUrl = origin || process.env.NEXT_PUBLIC_SITE_URL || ''
  const loginRedirect = baseUrl ? `${baseUrl}/auth/login` : undefined
  const disableEmailInDev =
    process.env.SUPABASE_DISABLE_EMAIL_IN_DEV === 'true' &&
    process.env.NODE_ENV === 'development'

  try {
    if (disableEmailInDev) {
      const adminClient = createAdminClient()
      const { data, error } = await adminClient.auth.admin.generateLink({
        type: 'signup',
        email,
        password,
        options: {
          redirectTo: loginRedirect ??
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
            `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
          data: {
            username,
          },
        },
      })

      if (error) {
        if (error.message?.includes('already registered') || error.message?.includes('User already exists')) {
          return {
            error: {
              message: 'duplicateEmail',
              isDuplicateEmail: true,
            },
          }
        }
        return { error: { message: error.message ?? 'signUpFailed' } }
      }

      if (!data?.user) {
        return { error: { message: 'signUpFailed' } }
      }

      return {
        data,
        usedAdminSignup: true,
        confirmLink: data?.properties?.action_link,
      }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: loginRedirect ??
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
          `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
        data: {
          username,
        },
      },
    })

    if (error) {
      if (error.message?.includes('already registered') || error.message?.includes('User already exists')) {
        return {
          error: {
            message: 'duplicateEmail',
            isDuplicateEmail: true,
          },
        }
      }
      return { error: { message: error.message ?? 'signUpFailed' } }
    }

    if (!data.user) {
      return { error: { message: 'signUpFailed' } }
    }

    // User profile is automatically created by database trigger
    revalidatePath('/', 'layout')
    return { data, usedAdminSignup: false }
  } catch (error) {
    console.error('Sign up error:', error)
    return { error: { message: 'unexpectedError' } }
  }
}

export async function login(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { error: { message: error.message ?? 'loginFailed' } }
    }

    if (!data.user) {
      return { error: { message: 'loginFailed' } }
    }

    revalidatePath('/', 'layout')
    return { data }
  } catch (error) {
    console.error('Login error:', error)
    return { error: { message: 'unexpectedError' } }
  }
}

export async function logOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/vi/auth/login')
}

export async function signInWithGoogle(locale: string = 'vi') {
  const supabase = await createClient()
  const baseUrl = await getSiteUrl()
  const callbackUrl = `${baseUrl}/auth/callback?next=/${locale}/dashboard`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error) {
    redirect(`/${locale}/auth/login?error_description=${encodeURIComponent(error.message)}`)
  }

  if (data.url) {
    redirect(data.url)
  }
}

export async function signInWithFacebook(locale: string = 'vi') {
  const supabase = await createClient()
  const baseUrl = await getSiteUrl()
  const callbackUrl = `${baseUrl}/auth/callback?next=/${locale}/dashboard`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: {
      redirectTo: callbackUrl,
    },
  })

  if (error) {
    redirect(`/${locale}/auth/login?error_description=${encodeURIComponent(error.message)}`)
  }

  if (data.url) {
    redirect(data.url)
  }
}
