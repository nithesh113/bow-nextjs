import nodemailer from 'nodemailer'

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

export async function sendMail(options: {
  to: string
  subject: string
  html: string
}) {
  if (!transporter) {
    throw new Error('SMTP_USER and SMTP_PASS are required to send email')
  }

  try {
    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      ...options,
    })
    console.log('Email sent:', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error: any) {
    console.error('SMTP Error:', error)
    return { success: false, error: error.message }
  }
}