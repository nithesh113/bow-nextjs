import dynamic from 'next/dynamic'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'

// Disable SSR — entire app is client-side (localStorage, state)
const AppShell = dynamic(() => import('@/components/layout/AppShell'), { ssr: false })

export default async function Home() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return <AppShell userName={user.name} />
}
