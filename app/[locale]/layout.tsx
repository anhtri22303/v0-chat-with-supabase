import React from 'react'

export default function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: { locale: string }
}>) {
  // Minimal locale layout to ensure the [locale] segment is recognized
  // by the Next.js app router. Nested pages like /[locale]/message-requests
  // require a layout or page in the dynamic segment folder.
  return <>{children}</>
}
