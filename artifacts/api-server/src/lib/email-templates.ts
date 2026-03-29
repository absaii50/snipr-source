// Beautiful branded HTML email templates for Snipr

const BRAND = {
  primary: "#728DA7",
  dark: "#0A0A0A",
  light: "#F4F4F6",
  text: "#3A3A3E",
  muted: "#8888A0",
  white: "#FFFFFF",
};

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Snipr</title>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.light};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:${BRAND.light};padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <div style="display:inline-block;background:${BRAND.dark};color:white;font-weight:800;font-size:20px;letter-spacing:-0.5px;padding:10px 20px;border-radius:12px;">
                snipr
              </div>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background:${BRAND.white};border-radius:16px;padding:40px;border:1px solid #E4E4EC;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="color:${BRAND.muted};font-size:12px;margin:0;line-height:1.5;">
                Snipr &mdash; AI-Powered Link Intelligence<br>
                <a href="https://snipr.sh" style="color:${BRAND.primary};text-decoration:none;">snipr.sh</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function button(text: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center" style="padding:24px 0 8px;">
        <a href="${url}" style="display:inline-block;background:${BRAND.dark};color:${BRAND.white};font-weight:600;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;letter-spacing:-0.2px;">
          ${text}
        </a>
      </td>
    </tr>
  </table>`;
}

export function getVerificationEmailHtml(name: string, verifyUrl: string): string {
  return layout(`
    <h1 style="color:${BRAND.dark};font-size:24px;font-weight:700;margin:0 0 8px;letter-spacing:-0.5px;">
      Verify your email
    </h1>
    <p style="color:${BRAND.text};font-size:15px;line-height:1.6;margin:0 0 4px;">
      Hi ${name},
    </p>
    <p style="color:${BRAND.text};font-size:15px;line-height:1.6;margin:0;">
      Welcome to Snipr! Please verify your email address to unlock all features and keep your account secure.
    </p>
    ${button("Verify Email Address", verifyUrl)}
    <p style="color:${BRAND.muted};font-size:12px;line-height:1.5;margin:16px 0 0;text-align:center;">
      Or copy and paste this link:<br>
      <a href="${verifyUrl}" style="color:${BRAND.primary};word-break:break-all;">${verifyUrl}</a>
    </p>
    <hr style="border:none;border-top:1px solid #E4E4EC;margin:24px 0;">
    <p style="color:${BRAND.muted};font-size:12px;line-height:1.5;margin:0;">
      If you didn't create an account on Snipr, you can safely ignore this email.
    </p>
  `);
}

export function getWelcomeEmailHtml(name: string, dashboardUrl: string): string {
  return layout(`
    <div style="text-align:center;padding-bottom:16px;">
      <div style="display:inline-block;width:56px;height:56px;background:#E8F5E9;border-radius:50%;line-height:56px;font-size:28px;">
        &#10003;
      </div>
    </div>
    <h1 style="color:${BRAND.dark};font-size:24px;font-weight:700;margin:0 0 8px;text-align:center;letter-spacing:-0.5px;">
      You're all set, ${name}!
    </h1>
    <p style="color:${BRAND.text};font-size:15px;line-height:1.6;margin:0 0 16px;text-align:center;">
      Your email is verified and your account is ready to go.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:8px;">
      <tr>
        <td style="background:${BRAND.light};border-radius:12px;padding:16px;">
          <p style="color:${BRAND.dark};font-weight:600;font-size:14px;margin:0 0 8px;">What you can do now:</p>
          <p style="color:${BRAND.text};font-size:13px;line-height:1.8;margin:0;">
            &#8226; Create short links with custom domains<br>
            &#8226; Track clicks with real-time analytics<br>
            &#8226; Use AI-powered link insights<br>
            &#8226; Set up redirect rules and A/B testing
          </p>
        </td>
      </tr>
    </table>
    ${button("Go to Dashboard", dashboardUrl)}
  `);
}
