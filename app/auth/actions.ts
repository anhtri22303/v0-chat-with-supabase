'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function signUp(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const username = formData.get('username') as string

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
          `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
        data: {
          username,
        },
      },
    })

    // Auto-confirm user for development (Supabase issue workaround)
    if (data.user && !error) {
      const { error: adminError } = await supabase.auth.admin.updateUserById(data.user.id, {
        email_confirm: true,
      })
      if (adminError) {
        console.error('Auto-confirm error:', adminError)
        // Continue anyway as the user is already created
      }
    }

    if (error) {
      return { error }
    }

    if (!data.user) {
      return { error: { message: 'Sign up failed' } }
    }

    // User profile is automatically created by database trigger
    revalidatePath('/', 'layout')
    return { data }
  } catch (error) {
    console.error('Sign up error:', error)
    return { error: { message: 'An unexpected error occurred' } }
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
      return { error }
    }

    if (!data.user) {
      return { error: { message: 'Login failed' } }
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
  } catch (error) {
    console.error('Login error:', error)
    return { error: { message: 'An unexpected error occurred' } }
  }
}

export async function logOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/auth/login')
}
