import { sendMail, FROM_EMAIL } from '@/lib/auth/smtp'
import { appUrl as makeAppUrl } from '@/lib/auth/urls'

export async function sendPasswordChangedEmail(
  email: string,
  name?: string,
  userId?: string | null
) {
  await sendMail({
    to: email,
    type: 'password_changed',
    userId: userId ?? null,
    subject: 'Your BOW password was changed successfully',
    html: `
      <div style="background:#0a0c14;padding:40px 20px;font-family:Arial,sans-serif;">
        <div style="max-width:600px;margin:0 auto;background:#1a1d2e;border:1px solid #2a2d3a;border-radius:16px;overflow:hidden;">

          <div style="
            padding:32px;
            text-align:center;
            background:linear-gradient(135deg,#10b981,#22c55e);
          ">
            <h1 style="margin:0;color:#ffffff;font-size:30px;">
              Password Updated ✓
            </h1>
          </div>

          <div style="padding:32px;">
            <p style="font-size:18px;color:#ffffff;">
              Hello ${name || 'there'},
            </p>

            <p style="color:#e0e0e0;line-height:1.8;">
              This email confirms that your BOW account password has been changed successfully.
            </p>

            <div style="
              margin-top:20px;
              background:#0f1118;
              border:1px solid #2a2d3a;
              border-radius:12px;
              padding:20px;
            ">
              <p style="margin:0;color:#ffffff;font-weight:bold;">
                Security Information
              </p>

              <ul style="
                margin-top:12px;
                color:#e0e0e0;
                line-height:1.8;
                padding-left:20px;
              ">
                <li>Password change completed successfully</li>
                <li>Your account remains secure</li>
                <li>You can now log in using your new password</li>
              </ul>
            </div>

            <div style="
              margin-top:24px;
              padding:16px;
              background:rgba(239,68,68,0.08);
              border-left:4px solid #ef4444;
              border-radius:8px;
            ">
              <p style="margin:0;color:#e0e0e0;">
                If you did NOT change your password, please reset it immediately and contact support.
              </p>
            </div>

            <div style="text-align:center;margin-top:32px;">
              <a
                href="${makeAppUrl('/login')}"
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
                Open BOW
              </a>
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

            <p style="
              margin-top:8px;
              color:#555555;
              font-size:11px;
            ">
              Helping students and part-time workers manage shifts, earnings and budgets.
            </p>
          </div>
        </div>
      </div>
    `,
  })
}