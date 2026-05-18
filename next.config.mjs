import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  ...(process.env.NODE_ENV === 'development'
    ? {
        allowedDevOrigins: ['192.168.1.6'],
      }
    : {}),
}

export default withNextIntl(nextConfig)
