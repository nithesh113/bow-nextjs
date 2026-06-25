'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { Settings } from 'lucide-react'
import { AuthUser } from '@/lib/auth/session'
import { updateAccount, resendVerificationEmailAction } from '@/app/actions/account'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import SettingsView from '@/components/settings/SettingsView'

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

  // ── Draft state (initialised from props) ──
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [currency, setCurrency] = useState(user.currency || 'JPY')
  const [location, setLocation] = useState(user.location || 'Japan')
  const [schoolFee, setSchoolFee] = useState<number | ''>(user.schoolFee ?? 840000)
  const [showSettings, setShowSettings] = useState(false)

  // Reset drafts if user prop changes
  useEffect(() => { setName(user.name) }, [user.name])
  useEffect(() => { setEmail(user.email) }, [user.email])
  useEffect(() => { setCurrency(user.currency || 'JPY') }, [user.currency])
  useEffect(() => { setLocation(user.location || 'Japan') }, [user.location])
  useEffect(() => { setSchoolFee(user.schoolFee ?? 840000) }, [user.schoolFee])

  // Dirty check: true when any field differs from the server value
  const isDirty =
    name !== user.name ||
    email !== user.email ||
    currency !== (user.currency || 'JPY') ||
    location !== (user.location || 'Japan') ||
    schoolFee !== (user.schoolFee ?? 840000)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsPending(true)
    const res = await updateAccount({ name, email, currency, location, schoolFee: Number(schoolFee) })
    if (res.success) {
      toast.success('Account updated successfully!')
      router.refresh()
    } else {
      toast.error(res.error || 'Failed to update account.')
    }
    setIsPending(false)
  }

  const handleResend = useCallback(() => {
    startResend(async () => {
      const res = await resendVerificationEmailAction(user.email)
      if (res.success) {
        toast.success(res.message || 'Verification email sent!')
      } else {
        toast.error(res.error || 'Failed to send verification email.')
      }
    })
  }, [user.email, startResend])

  return (
    <div style={{
      minHeight: '100%',
      padding: '0 0 120px 0',
      background: 'var(--bg)',
      animation: 'slideUp 0.3s ease',
    }}>

      {/* ── Profile Header Card ───────────────── */}
      <div style={{
        margin: 16,
        padding: '16px 18px',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 800, color: '#fff',
          boxShadow: '0 0 0 3px rgba(59,130,246,0.22)',
          fontFamily: 'var(--display)',
        }}>
          {getInitials(user.name)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{
            fontSize: 16, fontWeight: 800, fontFamily: 'var(--display)',
            margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {user.name}
          </h2>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.email}
          </p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6,
            padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700,
            background: isVerified ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
            color: isVerified ? '#34d399' : '#fbbf24',
            border: `1px solid ${isVerified ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
          }}>
            <span>{isVerified ? '✓' : '!'}</span>
            <span>{isVerified ? 'Verified' : 'Not Verified'}</span>
          </div>
        </div>

        {/* ⚙️ Settings toggle — opens the "More" page inline below */}
        <button
          type="button"
          onClick={() => setShowSettings((v) => !v)}
          aria-label={showSettings ? 'Hide settings' : 'Open settings'}
          aria-expanded={showSettings}
          title="Settings"
          style={{
            flexShrink: 0,
            width: 38, height: 38, borderRadius: '50%',
            background: showSettings
              ? 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)'
              : 'rgba(255,255,255,0.05)',
            border: showSettings
              ? '1px solid rgba(99,102,241,0.45)'
              : '1px solid var(--border)',
            color: showSettings ? '#fff' : 'var(--muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: showSettings ? '0 4px 16px rgba(99,102,241,0.35)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          <Settings size={18} strokeWidth={2.2} />
        </button>
      </div>

      {/* ── Verification Banner (unverified only) ── */}
      {!isVerified && (
        <div style={{
          margin: '0 16px 12px', padding: '14px 16px',
          background: 'rgba(245,158,11,0.07)',
          border: '1px solid rgba(245,158,11,0.28)',
          borderRadius: 14,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
              background: 'rgba(245,158,11,0.14)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
            }}>⚠️</div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: '#fbbf24', margin: 0 }}>Email not verified</p>
              <p style={{ fontSize: 11, color: 'var(--muted)', margin: '2px 0 0', lineHeight: 1.45 }}>
                Verify your email to keep your account secure.
              </p>
            </div>
          </div>
          <button onClick={handleResend} disabled={isResending} style={{
            padding: '9px 14px', borderRadius: 10, width: '100%',
            background: isResending ? 'var(--surface)' : 'rgba(245,158,11,0.14)',
            border: '1px solid rgba(245,158,11,0.38)',
            color: '#fbbf24', fontWeight: 700, fontSize: 12,
            cursor: isResending ? 'not-allowed' : 'pointer',
            opacity: isResending ? 0.6 : 1, transition: 'all 0.2s',
          }}>
            {isResending ? '✉️  Sending…' : '✉️  Resend Verification Email'}
          </button>
        </div>
      )}

      {/* ── Form ──────────────────────────────── */}
      <form onSubmit={handleSubmit} style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Profile Card */}
        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 16, overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
            fontSize: 11, fontWeight: 700, color: 'var(--muted)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>👤</span> Profile
          </div>

          <FormRow label="Full Name" icon="✏️">
            <input
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Your full name"
              style={inputStyle}
            />
          </FormRow>

          <FormRow label="Email Address" icon="📧">
            <input
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              style={inputStyle}
            />
          </FormRow>

          <FormRow label="School Fee Target" icon="🎓" last>
            <input
              name="schoolFee"
              type="number"
              value={schoolFee}
              onChange={(e) => setSchoolFee(e.target.value === '' ? '' : Number(e.target.value))}
              required
              placeholder="840000"
              style={inputStyle}
            />
          </FormRow>
        </div>

        {/* Preferences Card */}
        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 16, overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
            fontSize: 11, fontWeight: 700, color: 'var(--muted)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>⚙️</span> Preferences
          </div>

          <FormRow label="Currency" icon="💰">
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputStyle}>
              {CURRENCIES.map(c => (
                <option key={c.value} value={c.value}>
                  {c.flag} {c.label} ({c.symbol})
                </option>
              ))}
            </select>
          </FormRow>

          <FormRow label="Location" icon="📍" last>
            <select value={location} onChange={(e) => setLocation(e.target.value)} style={inputStyle}>
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
          disabled={!isDirty || isPending}
          style={{
            width: '100%', padding: '14px 20px', borderRadius: 14,
            background: (!isDirty || isPending) ? 'var(--surface)' : 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
            color: (!isDirty || isPending) ? 'var(--muted2)' : '#fff',
            border: 'none', fontWeight: 800, fontSize: 14,
            fontFamily: 'var(--display)', cursor: (!isDirty || isPending) ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            boxShadow: (!isDirty || isPending) ? 'none' : '0 4px 24px rgba(59,130,246,0.3)',
            letterSpacing: '0.02em', marginTop: 4,
            opacity: (!isDirty || isPending) ? 0.5 : 1,
          }}
        >
          {isPending ? '⏳  Saving…' : '💾  Save Changes'}
        </button>
      </form>

      {/* ── Settings (More page) — reveal via ⚙️ icon ── */}
      {showSettings && (
        <div
          role="region"
          aria-label="Settings"
          style={{ padding: '20px 0 4px', animation: 'slideUp 0.25s ease' }}
        >
          <div style={{
            margin: '0 16px 10px',
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 11, fontWeight: 700, color: 'var(--muted)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            <Settings size={14} strokeWidth={2.4} />
            <span>Settings</span>
          </div>
          <SettingsView />
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '9px 11px', borderRadius: 8,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 14, width: '100%', boxSizing: 'border-box',
}

function FormRow({
  label, icon, children, last,
}: {
  label: string; icon: string; children: React.ReactNode; last?: boolean;
}) {
  return (
    <div style={{
      padding: '12px 16px',
      borderBottom: last ? 'none' : '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <label style={{
        fontSize: 11, color: 'var(--muted)', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.05em',
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <span>{icon}</span> {label}
      </label>
      {children}
    </div>
  )
}
