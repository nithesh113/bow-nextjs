import nodemailer from 'nodemailer'
import { prisma } from './prisma'

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com'
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587
const SMTP_USER = process.env.SMTP_USER || ''
const SMTP_PASS = process.env.SMTP_PASS || ''

export const transporter = SMTP_USER && SMTP_PASS
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    })
  : null

export const FROM_EMAIL =
  process.env.EMAIL_FROM || `BOW <${SMTP_USER || 'noreply@example.com'}>`

/**
 * Send a transactional email AND record it in EmailLog so admins
 * can debug verification / spam / password-reset complaints from
 * /admin/emails without touching the DB.
 *
 * `type` is a short stable identifier we can filter on, e.g.
 * 'verification', 'welcome', 'password_reset', 'password_changed'.
 * The function never throws — both SMTP success and failure return
 * a structured result so the caller can react (e.g. cascade-delete
 * a half-provisioned user on send-failure).
 *
 * Note: EmailLog writes happen after the SMTP round-trip because we
 * want to capture providerMessageId / error verbatim. If the DB
 * write itself fails, we swallow that — an auth-flow path should
 * never be blocked by an audit-style log row.
 */
export async function sendMail(options: {
  to: string
  subject: string
  html: string
  type: string
  userId?: string | null
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!transporter) {
    return { success: false, error: 'SMTP_USER and SMTP_PASS are required to send email' }
  }

  try {
    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
    })
    console.log('Email sent:', info.messageId)
    await recordEmailLog({
      to: options.to,
      type: options.type,
      userId: options.userId ?? null,
      status: 'sent',
      providerMessageId: info.messageId,
      subject: options.subject,
    }).catch((err) =>
      console.error('[email-log] sent-row write failed:', err.message),
    )
    return { success: true, messageId: info.messageId }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('SMTP Error:', message)
    await recordEmailLog({
      to: options.to,
      type: options.type,
      userId: options.userId ?? null,
      status: 'failed',
      error: message,
      subject: options.subject,
    }).catch((err) =>
      console.error('[email-log] failed-row write failed:', err.message),
    )
    return { success: false, error: message }
  }
}

async function recordEmailLog(args: {
  to: string
  type: string
  userId: string | null
  status: 'sent' | 'failed'
  providerMessageId?: string
  error?: string
  subject?: string
}) {
  await prisma.emailLog.create({
    data: {
      to: args.to,
      type: args.type,
      userId: args.userId,
      status: args.status,
      providerMessageId: args.providerMessageId ?? null,
      error: args.error ?? null,
      subject: args.subject ?? null,
    },
  })
}