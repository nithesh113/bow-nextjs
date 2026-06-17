import type { Metadata, Viewport } from 'next'
import { Toaster } from '@/components/ToasterClient'
import './globals.css'

// Skip static prerendering of all routes — the static-export pass on Linux
// trips a known Next.js 14.2.x bug where the next/link chunk calls
// useContext() against a null React during the prerender phase.
// Pages still render correctly at request time as fully dynamic server routes.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '🇯🇵 Work Calendar — BOW v6.3',
  description: 'Japan work hours & budget tracker for student visa compliance',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0c14',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
