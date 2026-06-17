'use client'

import dynamic from 'next/dynamic'
import type { AuthUser } from '@/lib/auth/session'

const AppShell = dynamic(() => import('@/components/layout/AppShell'), { ssr: false })

export default function AppShellLoader({ user }: { user: AuthUser }) {
  return <AppShell user={user} />
}
