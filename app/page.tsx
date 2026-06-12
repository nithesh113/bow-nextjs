'use client'

import dynamic from 'next/dynamic'

// Disable SSR — entire app is client-side (localStorage, state)
const AppShell = dynamic(() => import('@/components/layout/AppShell'), { ssr: false })

export default function Home() {
  return <AppShell />
}
