'use client'

import { useState, useTransition } from 'react'
import { AuthUser } from '@/lib/auth/session'
import { updateAccount, resendVerificationEmailAction } from '@/app/actions/account'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const CURRENCIES = [
  { value: 'JPY', label: 'JPY', symbol: '¥', flag: '🇯🇵' },
  { value: 'USD', label: 'USD', symbol: '$', flag: '🇺🇸' },
  { value: 'EUR', label: 'EUR', symbol: '€', flag: '🇪🇺' },
  { value: 'GBP', label: 'GBP', symbol: '£', flag: '🇬🇧' },
  { value: 'INR', label: 'INR', symbol: '₹', flag: '🇮🇳' },
  { value: 'AUD', label: 'AUD', symbol: '$', flag: '🇦🇺' },
  { value: 'CAD', label: 'CAD', symbol: '$', flag: '🇨🇦' },
]

const LOCATIONS = [
  { value: 'Japan', flag: '🇯🇵' },
  { value: 'United States', flag: '🇺🇸' },
  { value: 'United Kingdom', flag: '🇬🇧' },
  { value: 'Europe', flag: '🇪🇺' },
  { value: 'India', flag: '🇮🇳' },
  { value: 'Australia', flag: '🇦🇺' },
  { value: 'Canada', flag: '🇨🇦' },
  { value: 'Other', flag: '🌍' },
]

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function AccountView({ user }: { user: AuthUser }) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [isResending, startResend] = useTransition()
  const isVerified = !!user.emailVerified

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsPending(true)
    const formData = new FormData(e.currentTarget)
    const res = await updateAccount({
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      currency: formData.get('currency') as string,
      location: formData.get('location') as string,
    })
    if (res.success) {
      toast.success('Account updated successfully!')
      router.refresh()
    } else {
      toast.error(res.error || 'Failed to update account.')
    }
    setIsPending(false)
  }

  const handleResend = () => {
    startResend(async () => {
      const res = await resendVerificationEmailAction(user.email)
      if (res.success) {
        toast.success(res.message || 'Verification email sent!')
      } else {
        toast.error(res.error || 'Failed to send verification email.')
      }
    })
  }

  return (
    <div style={{
      minHeight: '100%',
      padding: '0 0 120px 0',
      background: 'var(--bg)',
      animation: 'slideUp 0.3s ease',
    }}>

      {/* Hero Header */}
      <div style={{
        padding: '32px 20px 24px',
        background: 'linear-gradient(160deg, rgba(59,130,246,0.12) 0%, rgba(10,12,20,0) 60%)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
      }}>
        {/* Avatar */}
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          fontWeight: 800,
          color: '#fff',
          flexShrink: 0,
          boxShadow: '0 0 0 3px rgba(59,130,246,0.25)',
          fontFamily: 'var(--display)',
        }}>
          {getInitials(user.name)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{
            fontSize: 20,
            fontWeight: 800,
            fontFamily: 'var(--display)',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {user.name}
          </h2>
          <p style={{
            fontSize: 13,
            color: 'var(--muted)',
            margin: '3px 0 0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {user.email}
          </p>
          {/* Inline verification badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            marginTop: 6,
            padding: '3px 10px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            background: isVerified
              ? 'rgba(16,185,129,0.12)'
              : 'rgba(245,158,11,0.12)',
            color: isVerified ? '#34d399' : '#fbbf24',
            border: `1px solid ${isVerified ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
          }}>
            <span>{isVerified ? '✓' : '!'}</span>
            <span>{isVerified ? 'Email Verified' : 'Not Verified'}</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Verification Banner */}
        {!isVerified && (
          <div style={{
            padding: '16px',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(234,179,8,0.04) 100%)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(245,158,11,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                flexShrink: 0,
              }}>⚠️</div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#fbbf24', margin: 0 }}>
                  Email not verified
                </p>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0', lineHeight: 1.5 }}>
                  Verify your email to secure your account and enable all features.
                </p>
              </div>
            </div>
            <button
              onClick={handleResend}
              disabled={isResending}
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                background: isResending ? 'var(--surface)' : 'rgba(245,158,11,0.15)',
                border: '1px solid rgba(245,158,11,0.4)',
                color: '#fbbf24',
                fontWeight: 700,
                fontSize: 13,
                cursor: isResending ? 'not-allowed' : 'pointer',
                opacity: isResending ? 0.6 : 1,
                width: '100%',
                transition: 'all 0.2s',
              }}
            >
              {isResending ? '✉️  Sending...' : '✉️  Send Verification Email'}
            </button>
          </div>
        )}

        {/* Verified card */}
        {isVerified && (
          <div style={{
            padding: '14px 16px',
            background: 'rgba(16,185,129,0.06)',
            border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(16,185,129,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              flexShrink: 0,
            }}>✅</div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, color: '#34d399', margin: 0 }}>
                Email Verified
              </p>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0' }}>
                Verified on {new Date(user.emailVerified!).toLocaleDateString('en-US', {
                  day: 'numeric', month: 'short', year: 'numeric'
                })}
              </p>
            </div>
          </div>
        )}

        {/* Form Card */}
        <form onSubmit={handleSubmit}>
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{ fontSize: 16 }}>👤</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Profile
              </span>
            </div>

            <FormRow label="Full Name" icon="✏️">
              <input
                name="name"
                defaultValue={user.name}
                required
                placeholder="Your full name"
                style={inputStyle}
              />
            </FormRow>

            <FormRow label="Email Address" icon="📧" last>
              <input
                name="email"
                type="email"
                defaultValue={user.email}
                required
                placeholder="you@example.com"
                style={inputStyle}
              />
            </FormRow>
          </div>

          {/* Preferences Card */}
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            overflow: 'hidden',
            marginTop: 12,
          }}>
            <div style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span style={{ fontSize: 16 }}>⚙️</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Preferences
              </span>
            </div>

            <FormRow label="Currency" icon="💰">
              <select name="currency" defaultValue={user.currency || 'JPY'} style={inputStyle}>
                {CURRENCIES.map(c => (
                  <option key={c.value} value={c.value}>
                    {c.flag} {c.label} ({c.symbol})
                  </option>
                ))}
              </select>
            </FormRow>

            <FormRow label="Location" icon="📍" last>
              <select name="location" defaultValue={user.location || 'Japan'} style={inputStyle}>
                {LOCATIONS.map(l => (
                  <option key={l.value} value={l.value}>
                    {l.flag} {l.value}
                  </option>
                ))}
              </select>
            </FormRow>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            disabled={isPending}
            style={{
              width: '100%',
              marginTop: 16,
              padding: '15px 20px',
              borderRadius: 14,
              background: isPending
                ? 'var(--surface)'
                : 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
              color: '#fff',
              border: 'none',
              fontWeight: 800,
              fontSize: 15,
              fontFamily: 'var(--display)',
              opacity: isPending ? 0.7 : 1,
              cursor: isPending ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: isPending ? 'none' : '0 4px 24px rgba(59,130,246,0.3)',
              letterSpacing: '0.02em',
            }}
          >
            {isPending ? '⏳  Saving...' : '💾  Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box',
}

function FormRow({
  label,
  icon,
  children,
  last,
}: {
  label: string
  icon: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div style={{
      padding: '14px 16px',
      borderBottom: last ? 'none' : '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <label style={{
        fontSize: 12,
        color: 'var(--muted)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span>{icon}</span>
        {label}
      </label>
      {children}
    </div>
  )
}
