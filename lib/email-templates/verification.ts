export interface VerificationEmailProps {
  code: string;
}

export function renderVerificationEmail({ code }: VerificationEmailProps): {
  html: string;
  text: string;
} {
  const text = `Nexus - Verify your email

Your 6-digit verification code is: ${code}

This code expires in 10 minutes.

If you didn't create a Nexus account, you can ignore this email.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email</title>
</head>
<body style="margin: 0; padding: 32px 16px; background-color: #F6F4EF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #16151A; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 480px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; padding: 40px 32px; border: 1px solid #E6E2D8; box-sizing: border-box;">
    <!-- Logo & Brand Header -->
    <div style="margin-bottom: 28px;">
      <span style="display: inline-block; font-size: 18px; font-weight: 700; color: #5046B8; letter-spacing: -0.4px;">Nexus</span>
    </div>

    <!-- Headline -->
    <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 600; line-height: 1.3; color: #16151A; letter-spacing: -0.3px;">
      Verify your email
    </h1>
    <p style="margin: 0 0 28px 0; font-size: 14px; line-height: 1.5; color: #55535C;">
      Please use the following 6-digit code to complete your registration.
    </p>

    <!-- OTP Code Display -->
    <div style="background-color: #F6F4EF; border: 1px solid #E6E2D8; border-radius: 8px; padding: 20px 16px; text-align: center; margin-bottom: 24px;">
      <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #16151A; display: inline-block; padding-left: 8px;">
        ${code}
      </span>
    </div>

    <!-- Expiration & Disclaimer -->
    <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.5; color: #55535C;">
      This code expires in <strong>10 minutes</strong>.
    </p>
    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #8C8894;">
      If you didn't create a Nexus account, you can ignore this email.
    </p>
  </div>
</body>
</html>`;

  return { html, text };
}
