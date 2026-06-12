import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  if (!resend) {
    throw new Error('RESEND_API_KEY is required')
  }

  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'BOW <onboarding@resend.dev>',
    to: email,
    subject: 'Reset your BOW password',
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h1 style="font-size:20px;margin-bottom:12px">Reset your BOW password</h1>
        <p>Use the button below to set a new password. This link expires in 1 hour.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;background:#3b82f6;color:#ffffff;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:700">
            Reset password
          </a>
        </p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `,
  })
}
