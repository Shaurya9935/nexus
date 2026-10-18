export interface ResetPasswordEmailProps {
  url: string;
}

export function renderResetPasswordEmail({ url }: ResetPasswordEmailProps): {
  html: string;
  text: string;
} {
  const text = `Nexus - Reset your password

Click the link below to reset your Nexus password:
${url}

This link expires in 1 hour.

If you didn't request a password reset, you can safely ignore this email.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="margin: 0; padding: 32px 16px; background-color: #F6F4EF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #16151A; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 480px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; padding: 40px 32px; border: 1px solid #E6E2D8; box-sizing: border-box;">
    <!-- Logo & Brand Header -->
    <div style="margin-bottom: 28px;">
      <span style="display: inline-block; font-size: 18px; font-weight: 700; color: #5046B8; letter-spacing: -0.4px;">Nexus</span>
    </div>

    <!-- Headline -->
    <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 600; line-height: 1.3; color: #16151A; letter-spacing: -0.3px;">
      Reset your password
    </h1>
    <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.5; color: #55535C;">
      We received a request to reset your password. Click the button below to choose a new password.
    </p>

    <!-- Reset CTA Button -->
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${url}" target="_blank" style="display: inline-block; background-color: #5046B8; color: #FFFFFF; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 7px;">
        Reset password
      </a>
    </div>

    <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.5; color: #55535C;">
      This link expires in <strong>1 hour</strong>.
    </p>
    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #8C8894;">
      If you didn't request a password reset, you can safely ignore this email.
    </p>
  </div>
</body>
</html>`;

  return { html, text };
}
