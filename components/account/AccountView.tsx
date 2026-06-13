'use client'

import { useState } from 'react'
import { AuthUser } from '@/lib/auth/session'
import { updateAccount } from '@/app/actions/account'
import { useRouter } from 'next/navigation'

export default function AccountView({ user }: { user: AuthUser }) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsPending(true)
    setMessage('')
    setError('')

    const formData = new FormData(e.currentTarget)
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const currency = formData.get('currency') as string
    const location = formData.get('location') as string

    const res = await updateAccount({ name, email, currency, location })
    if (res.success) {
      setMessage('Account updated successfully.')
      router.refresh() // Refresh to update the server session state locally
    } else {
      setError(res.error || 'Failed to update account.')
    }
    setIsPending(false)
  }

  return (
    <div style={{ padding: '24px 16px', maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ fontSize: 24, marginBottom: 24, fontFamily: 'var(--display)' }}>Account Details</h2>
      
      {message && <div style={{ padding: 12, background: 'var(--green)', color: '#fff', borderRadius: 8, marginBottom: 16 }}>{message}</div>}
      {error && <div style={{ padding: 12, background: 'var(--red)', color: '#fff', borderRadius: 8, marginBottom: 16 }}>{error}</div>}
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Name</label>
          <input 
            name="name" 
            defaultValue={user.name} 
            required 
            style={{ padding: 12, borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }} 
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Email</label>
          <input 
            name="email" 
            type="email"
            defaultValue={user.email} 
            required 
            style={{ padding: 12, borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }} 
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Currency</label>
          <select 
            name="currency" 
            defaultValue={user.currency || 'JPY'} 
            style={{ padding: 12, borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <option value="JPY">JPY (¥)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="INR">INR (₹)</option>
            <option value="AUD">AUD ($)</option>
            <option value="CAD">CAD ($)</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 13, color: 'var(--muted)' }}>Location</label>
          <select 
            name="location" 
            defaultValue={user.location || 'Japan'} 
            style={{ padding: 12, borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <option value="Japan">Japan</option>
            <option value="United States">United States</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="Europe">Europe</option>
            <option value="India">India</option>
            <option value="Australia">Australia</option>
            <option value="Canada">Canada</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <button 
          type="submit" 
          disabled={isPending}
          style={{ 
            marginTop: 16, 
            padding: 14, 
            borderRadius: 8, 
            background: 'var(--accent)', 
            color: '#fff', 
            border: 'none', 
            fontWeight: 'bold',
            opacity: isPending ? 0.7 : 1,
            cursor: isPending ? 'not-allowed' : 'pointer'
          }}
        >
          {isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}
