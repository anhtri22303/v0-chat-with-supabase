'use client'

import { usePathname } from 'next/navigation'
import { GlobalSidebar } from './global-sidebar'

export function ChatLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Locale-aware: /en/dashboard or /vi/dashboard
  const isHome = pathname.endsWith('/dashboard')
  
  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      {/* Sidebar - full width on mobile if Home, hidden on mobile if Chat. Always visible on desktop. */}
      <div 
        className={`w-full md:w-80 lg:w-96 border-r flex flex-col h-full flex-shrink-0 transition-all ${
          !isHome ? 'hidden md:flex' : 'flex'
        }`}
      >
        <GlobalSidebar />
      </div>
      
      {/* Main Content - hidden on mobile if Home, full width if Chat. Always visible on desktop. */}
      <main 
        className={`flex-1 h-full flex-col min-w-0 bg-background ${
          isHome ? 'hidden md:flex' : 'flex'
        }`}
      >
        {children}
      </main>
    </div>
  )
}
