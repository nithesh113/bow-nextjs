import { sendMail, FROM_EMAIL } from '@/lib/auth/smtp'

export async function sendWelcomeEmail(email: string, name: string, userId?: string | null) {
  await sendMail({
    to: email,
    type: 'welcome',
    userId: userId ?? null,
    subject: 'Welcome to BOW!',
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:0 auto;padding:20px;">
        <h1 style="font-size:20px;margin-bottom:4px;font-weight:normal;">Hi ${name},</h1>
        <h2 style="font-size:24px;margin-top:0;margin-bottom:16px;">Welcome to BOW!</h2>
        
        <p style="margin-bottom:16px;">Thank you for creating your account.</p>
        <p style="margin-bottom:24px;">BOW was built to help students and part-time workers manage their shifts, earnings, expenses, budgets, and savings goals from a single dashboard.</p>
        
        <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin-bottom:24px;">
          <h3 style="font-size:16px;margin-top:0;margin-bottom:12px;">With BOW you can:</h3>
          <ul style="list-style-type:none;padding:0;margin:0;">
            <li style="margin-bottom:8px;">📅 Plan and track work shifts</li>
            <li style="margin-bottom:8px;">⏰ Record actual work hours</li>
            <li style="margin-bottom:8px;">💴 Forecast monthly earnings</li>
            <li style="margin-bottom:8px;">📊 Monitor weekly visa work-hour limits</li>
            <li style="margin-bottom:8px;">💰 Track expenses and budgets</li>
            <li style="margin-bottom:8px;">🎯 Build savings goals</li>
            <li>🔒 Keep your data private and under your control</li>
          </ul>
        </div>
        
        <h3 style="font-size:18px;margin-bottom:12px;">Getting Started:</h3>
        <ol style="margin-top:0;margin-bottom:24px;padding-left:20px;">
          <li style="margin-bottom:8px;">Create your first Job</li>
          <li style="margin-bottom:8px;">Add upcoming shifts</li>
          <li style="margin-bottom:8px;">Record actual work hours</li>
          <li style="margin-bottom:8px;">Set up your monthly budget</li>
          <li>Start tracking expenses</li>
        </ol>
        
        <p style="margin-bottom:4px;">We're excited to have you with us.</p>
        <p style="margin-bottom:24px;">Thank you for choosing BOW.</p>
        
        <hr style="border:none;border-top:1px solid #e5e7eb;margin-bottom:24px;" />
        
        <p style="font-size:14px;color:#111827;font-weight:bold;margin:0;">— The BOW Team</p>
        <p style="font-size:12px;color:#6b7280;margin-top:4px;">Budget + Shift + Earnings Tracker</p>
      </div>
    `,
  })
}