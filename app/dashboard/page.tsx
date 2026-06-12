import dynamic from 'next/dynamic'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'

const AppShell = dynamic(() => import('@/components/layout/AppShell'), { ssr: false })

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return <AppShell userName={user.name} />
}
