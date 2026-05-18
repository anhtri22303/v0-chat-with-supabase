import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const supportedLocales = ['en', 'vi'] as const
type SupportedLocale = (typeof supportedLocales)[number]

function getLocaleFromPath(pathname: string): SupportedLocale {
  const segment = pathname.split('/')[1]
  return segment === 'en' || segment === 'vi' ? segment : 'vi'
}

function stripLocalePrefix(pathname: string): string {
  const segment = pathname.split('/')[1]
  if (segment === 'en' || segment === 'vi') {
    const rest = pathname.split('/').slice(2).join('/')
    return `/${rest}`.replace(/\/$/, '') || '/'
  }
  return pathname
}

export async function proxy(request: NextRequest) {
  const locale = getLocaleFromPath(request.nextUrl.pathname)
  const normalizedPath = stripLocalePrefix(request.nextUrl.pathname)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-next-intl-locale', locale)

  let response =
    normalizedPath !== request.nextUrl.pathname
      ? NextResponse.rewrite(new URL(normalizedPath, request.url), {
          request: { headers: requestHeaders },
        })
      : NextResponse.next({ request: { headers: requestHeaders } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll().map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
          }))
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If user is logged in and tries to access auth pages, redirect to dashboard
  if (user && request.nextUrl.pathname.startsWith('/auth/')) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url))
  }

  // If user is not logged in and tries to access protected pages, redirect to login
  if (
    !user &&
    (request.nextUrl.pathname.startsWith('/dashboard') ||
      request.nextUrl.pathname.startsWith('/dm/') ||
      request.nextUrl.pathname.startsWith('/clubs/') ||
      request.nextUrl.pathname.startsWith(`/${locale}/dashboard`) ||
      request.nextUrl.pathname.startsWith(`/${locale}/dm/`) ||
      request.nextUrl.pathname.startsWith(`/${locale}/clubs/`))
  ) {
    return NextResponse.redirect(new URL(`/${locale}/auth/login`, request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
