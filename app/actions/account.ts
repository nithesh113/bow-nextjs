'use server'

import { prisma } from '@/lib/auth/prisma'
import { getCurrentUser } from '@/lib/auth/session'

export async function updateAccount(data: { name: string; email: string; currency: string; location: string }) {
  const user = await getCurrentUser()
  
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: data.name,
        email: data.email,
        currency: data.currency,
        location: data.location,
      }
    })
    return { success: true }
  } catch (error) {
    console.error('Error updating account:', error)
    return { success: false, error: 'Failed to update account. Email might already be taken.' }
  }
}
