// Magic-link email sender. Uses Resend in production (when RESEND_API_KEY is
// set) and logs the link to the terminal in local dev so the flow is
// testable without any external account.

import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM ?? "CRM;IN <hi@crm.twosetai.com>";

const isResendConfigured = Boolean(RESEND_API_KEY);
const resend = isResendConfigured ? new Resend(RESEND_API_KEY) : null;

export async function sendMagicLinkEmail(opts: {
  to: string;
  name: string;
  verifyUrl: string;
}): Promise<void> {
  const { to, name, verifyUrl } = opts;

  const subject = "Your sign-in link for CRM;IN";
  const html = `<p>Hi ${escapeHtml(name)},</p>
<p>Click the link below to sign in to CRM;IN:</p>
<p><a href="${verifyUrl}">${verifyUrl}</a></p>
<p>This link expires in 15 minutes. If you didn't request it, you can ignore this email.</p>
<p>TwoSetAI Lab</p>`;
  const text = `Hi ${name},

Click the link below to sign in to CRM;IN:
${verifyUrl}

This link expires in 15 minutes. If you didn't request it, you can ignore this email.

TwoSetAI Lab`;

  if (!resend) {
    console.log("[email:dev] Resend not configured. Magic link below.");
    console.log(`  to:  ${to}`);
    console.log(`  url: ${verifyUrl}`);
    return;
  }

  await resend.emails.send({
    from: RESEND_FROM,
    to,
    subject,
    html,
    text,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const emailMode = isResendConfigured ? "resend" : "console-dev";
