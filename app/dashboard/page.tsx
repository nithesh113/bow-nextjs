import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import AppShellLoader from '@/components/layout/AppShellLoader'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return <AppShellLoader user={user} />
}
