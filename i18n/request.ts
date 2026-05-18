import { getRequestConfig } from 'next-intl/server'

const supportedLocales = ['en', 'vi'] as const

type SupportedLocale = (typeof supportedLocales)[number]

export default getRequestConfig(async ({ locale }) => {
  const resolvedLocale = (supportedLocales.includes(locale as SupportedLocale)
    ? locale
    : 'vi') as SupportedLocale

  return {
    locale: resolvedLocale,
    messages: (await import(`../messages/${resolvedLocale}.json`)).default,
  }
})
