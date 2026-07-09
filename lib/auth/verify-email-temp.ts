import { sendMail, FROM_EMAIL } from '@/lib/auth/smtp'

export async function sendVerificationEmail(
  email: string,
  verifyUrl: string,
  userId?: string | null
) {
  const result = await sendMail({
    to: email,
    type: 'verification',
    userId: userId ?? null,
    subject: 'Verify your BOW email',
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
              Verify your email address
            </h2>

            <p style="color:#e0e0e0;line-height:1.7;">
              Please confirm that you want to use this as your BOW account email address.
            </p>

            <p style="color:#e0e0e0;line-height:1.7;">
              Click the button below to verify your email.
              This link will expire in 24 hours.
            </p>

            <div style="text-align:center;margin:30px 0;">
              <a
                href="${verifyUrl}"
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
                Verify Email
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
              >${verifyUrl}</p>
            </div>
          </div>
        </div>
      </div>
    `,
  })

  return result
}