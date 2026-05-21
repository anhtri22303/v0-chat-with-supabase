import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'
import { NotificationProvider } from '@/contexts/notification-context'
import { PresenceProvider } from '@/contexts/presence-context'
import { CallProvider } from '@/contexts/call-context'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'ChaTChiT - Real-time Chat',
  description: 'Real-time chat application for clubs and direct messages',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/Logo_ChaTChiT.ico',
        sizes: '32x32',
        type: 'image/x-icon',
      },
      {
        url: '/Logo_ChaTChiT.svg',
        type: 'image/svg+xml',
      },
    ],
    shortcut: '/Logo_ChaTChiT.ico',
    apple: '/Logo_ChaTChiT.png',
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} className="bg-background" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
            <NotificationProvider>
              <PresenceProvider>
                <CallProvider>
                  {children}
                  <Toaster position="top-center" />
                </CallProvider>
              </PresenceProvider>
            </NotificationProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
