'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: '!py-4 !px-5',
          title: '!text-lg !font-semibold',
          description: '!text-base group-data-[type=info]:!text-sky-200/80',
          info: '!bg-sky-950 !border-sky-500/40 !text-sky-50 [&>[data-icon]]:!text-sky-400',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
