import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@/lib/auth-adapter";

function buildSignInEmail(code: string): { html: string; text: string } {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sign in to psswrd.store</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f6;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Header / Wordmark -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:10px;vertical-align:middle;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:36px;height:36px;background-color:#eef0ff;border-radius:10px;text-align:center;vertical-align:middle;">
                          <img src="https://psswrd.store/lock.svg" width="18" height="18" alt="" style="display:block;margin:9px auto;" />
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#111116;">psswrd</span><span style="font-size:15px;font-weight:400;color:#4f5eed;">.store</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:16px;border:1px solid #e2e2ea;padding:40px 40px 36px;">

              <!-- Tagline badge -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background-color:#eef0ff;border-radius:100px;padding:5px 12px;">
                    <span style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#4f5eed;">Secure Credential Vault</span>
                  </td>
                </tr>
              </table>

              <!-- Heading -->
              <p style="margin:0 0 10px;font-size:22px;font-weight:700;color:#111116;letter-spacing:-0.3px;line-height:1.3;">
                Your sign-in code
              </p>

              <!-- Body text -->
              <p style="margin:0 0 28px;font-size:14px;color:#6b6b80;line-height:1.6;">
                Enter this code on the psswrd.store sign-in page. It expires in <strong style="color:#111116;font-weight:600;">10 minutes</strong> and can only be used once.
              </p>

              <!-- Code display -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background-color:#f4f4f6;border:1px solid #e2e2ea;border-radius:12px;padding:20px 36px;text-align:center;">
                    <span style="font-size:36px;font-weight:700;letter-spacing:0.2em;color:#111116;font-family:'SF Mono',Menlo,Consolas,monospace;">${code}</span>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td style="border-top:1px solid #e2e2ea;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;color:#9898aa;">Do not share this code with anyone.</p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0 0 8px;font-size:12px;color:#9898aa;">
                If you didn't request this email, you can safely ignore it.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 8px;">
                    <span style="font-size:11px;color:#b0b0c0;font-weight:600;letter-spacing:0.05em;">psswrd.store</span>
                  </td>
                  <td style="padding:0 8px;border-left:1px solid #d4d4e0;">
                    <span style="font-size:11px;color:#b0b0c0;font-family:'SF Mono',Menlo,Consolas,monospace;">AES-256-GCM ENCRYPTED</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Sign in to psswrd.store\n\nYour sign-in code is: ${code}\n\nIt expires in 10 minutes and can only be used once. Do not share this code with anyone.\n\nIf you didn't request this, you can safely ignore this email.\n\npsswrd.store — AES-256-GCM Encrypted`;

  return { html, text };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter,
  session: { strategy: "jwt" },
  providers: [
    Google({ allowDangerousEmailAccountLinking: true }),
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.RESEND_FROM ?? "psswrd.store <noreply@servvio.com>",
      maxAge: 10 * 60, // 10 minutes
      generateVerificationToken: async () => {
        return String(Math.floor(100000 + Math.random() * 900000));
      },
      async sendVerificationRequest({ identifier: email, token, provider }) {
        const { html, text } = buildSignInEmail(token);
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: provider.from,
            to: email,
            subject: "Your psswrd.store sign-in code",
            html,
            text,
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Resend error: ${body}`);
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      return !!user.email;
    },
    async session({ session }) {
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
