import { sendMail, FROM_EMAIL } from '@/lib/auth/smtp'

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string
) {
  await sendMail({
    to: email,
    subject: 'Reset your BOW password',
    html: `
      <div style="background:#0a0c14;padding:40px 20px;font-family:Arial,sans-serif;">
        <div style="max-width:600px;margin:0 auto;background:#1a1d2e;border:1px solid #2a2d3a;border-radius:16px;overflow:hidden;">
          
          <div style="padding:32px;text-align:center;border-bottom:1px solid #2a2d3a;">
            <h1 style="margin:0;color:#ffffff;font-size:30px;">BOW</h1>
            <p style="margin-top:8px;color:#888888;">
              Budget + Shift + Earnings Tracker
            </p>
          </div>

          <div style="padding:32px;">
            <h2 style="color:#ffffff;margin-top:0;">
              Reset your password
            </h2>

            <p style="color:#e0e0e0;line-height:1.7;">
              We received a request to reset the password for your BOW account.
            </p>

            <p style="color:#e0e0e0;line-height:1.7;">
              Click the button below to create a new password.
              This link will expire in 1 hour.
            </p>

            <div style="text-align:center;margin:30px 0;">
              <a
                href="${resetUrl}"
                style="
                  background:#3b82f6;
                  color:#ffffff;
                  text-decoration:none;
                  padding:14px 24px;
                  border-radius:10px;
                  font-weight:bold;
                  display:inline-block;
                "
              >
                Reset Password
              </a>
            </div>

            <div style="
              background:#0f1118;
              border:1px solid #2a2d3a;
              padding:16px;
              border-radius:10px;
              margin-top:20px;
            ">
              <p style="margin:0;color:#888888;font-size:13px;">
                If the button doesn't work, copy and paste this link:
              </p>

              <p
                style="
                  margin-top:10px;
                  color:#3b82f6;
                  word-break:break-all;
                  font-size:13px;
                "
              >${resetUrl}</p>
            </div>

            <div style="
              margin-top:24px;
              background:rgba(239,68,68,0.08);
              border-left:4px solid #ef4444;
              padding:16px;
              border-radius:8px;
            ">
              <p style="margin:0;color:#e0e0e0;">
                If you didn't request a password reset,
                you can safely ignore this email.
              </p>
            </div>
          </div>

          <div style="
            border-top:1px solid #2a2d3a;
            padding:24px;
            text-align:center;
          ">
            <p style="margin:0;color:#888888;font-size:12px;">
              BOW • Budget + Shift + Earnings Tracker
            </p>
          </div>
        </div>
      </div>
    `,
  })
}