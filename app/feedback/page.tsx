import Link from 'next/link'
import { requireUser } from '@/lib/auth/guards'
import FeedbackForm from './FeedbackForm'

/**
 * /feedback — user-side submission (Plan §26).
 *
 * Minimal page; the work is in FeedbackForm.tsx. We log the source
 * page through the URL so the admin can correlate reports with the
 *   pages they were about.
 *
 * Auth: any signed-in user. We deliberately do NOT protect this
 * page by admin role — this is the user's voice channel.
 */
export default async function FeedbackPage({
  searchParams = {},
}: {
  searchParams?: Record<string, string | undefined>
}) {
  await requireUser()
  const sourcePage = (searchParams.from ?? '').toString().slice(0, 200) || null

  return (
    <div style={{
      maxWidth: 520, margin: '0 auto',
      padding: '24px 14px',
    }}>
      <Link href="/dashboard" style={{
        display: 'inline-block',
        fontSize: 11, color: 'var(--muted)',
        textDecoration: 'none', marginBottom: 12,
      }}>
        ← Back
      </Link>

      <h1 style={{
        fontSize: 22, fontWeight: 800, fontFamily: 'var(--display)',
        margin: '0 0 4px 0',
      }}>
        💬 Send feedback
      </h1>
      <p style={{
        margin: '0 0 16px 0',
        fontSize: 13, color: 'var(--muted)', lineHeight: 1.5,
      }}>
        Reviews, feature ideas, bugs — anything you'd like the team
        to know. Admins triage this queue daily.
      </p>

      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 16,
      }}>
        <FeedbackForm sourcePage={sourcePage} />
      </div>
    </div>
  )
}
