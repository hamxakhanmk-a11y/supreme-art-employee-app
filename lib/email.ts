// Lightweight Resend wrapper. If RESEND_API_KEY isn't set, sendEmail
// returns { sent: false } so the caller can fall back to showing the
// invite link to the admin instead of throwing.

const RESEND_API_URL = "https://api.resend.com/emails";

export function isEmailConfigured() {
  return !!process.env.RESEND_API_KEY;
}

function defaultSender() {
  return process.env.EMAIL_FROM || "Supreme Art HR <onboarding@resend.dev>";
}

export interface SendArgs {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendArgs) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: "not_configured" as const };
  if (!to || !subject || (!html && !text)) {
    return { sent: false, reason: "missing_fields" as const };
  }
  try {
    const r = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: defaultSender(),
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
      }),
    });
    if (!r.ok) {
      const err = await r.text().catch(() => "");
      console.error("Resend send failed:", r.status, err);
      return { sent: false as const, reason: "send_failed" as const, status: r.status, error: err };
    }
    return { sent: true as const };
  } catch (e: any) {
    console.error("Resend exception:", e?.message);
    return { sent: false as const, reason: "exception" as const, error: e?.message };
  }
}

function escapeHtml(s: string | null | undefined) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}

function roleLabel(role: string) {
  if (role === "ceo") return "CEO (view-only)";
  if (role === "admin") return "Admin";
  if (role === "hr") return "HR";
  return role;
}

const BRAND = "#A32D2D";

export function inviteTemplate(args: { inviterName: string; inviteeName: string; role: string; setupUrl: string; hours: number }) {
  const { inviterName, inviteeName, role, setupUrl, hours } = args;
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
      <h2 style="color:${BRAND};margin:0 0 16px">You've been invited to Supreme Art HR</h2>
      <p>Hi ${escapeHtml(inviteeName)},</p>
      <p><b>${escapeHtml(inviterName)}</b> has added you as a <b>${escapeHtml(roleLabel(role))}</b> on the Supreme Art HR / Employee management system.</p>
      <p>Click the button below to set your password and finish creating your account:</p>
      <p style="margin:24px 0">
        <a href="${setupUrl}" style="background:${BRAND};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Set Your Password</a>
      </p>
      <p style="color:#888;font-size:13px">Or copy this link into your browser:<br><span style="word-break:break-all">${setupUrl}</span></p>
      <p style="color:#888;font-size:13px">This link expires in ${hours} hours.</p>
    </div>`;
  const text = `Hi ${inviteeName},\n\n${inviterName} has added you as a ${roleLabel(role)} on Supreme Art HR.\n\nSet your password: ${setupUrl}\n\nThis link expires in ${hours} hours.`;
  return { html, text };
}

export function resetTemplate(args: { inviteeName: string; setupUrl: string; hours: number }) {
  const { inviteeName, setupUrl, hours } = args;
  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
      <h2 style="color:${BRAND};margin:0 0 16px">Reset your password</h2>
      <p>Hi ${escapeHtml(inviteeName)},</p>
      <p>You (or an admin) requested a password reset for your Supreme Art HR account.</p>
      <p style="margin:24px 0">
        <a href="${setupUrl}" style="background:${BRAND};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Set a New Password</a>
      </p>
      <p style="color:#888;font-size:13px">Or copy this link into your browser:<br><span style="word-break:break-all">${setupUrl}</span></p>
      <p style="color:#888;font-size:13px">This link expires in ${hours} hours. If you didn't request this, you can safely ignore the email.</p>
    </div>`;
  const text = `Hi ${inviteeName},\n\nReset your Supreme Art HR password: ${setupUrl}\n\nThis link expires in ${hours} hours.`;
  return { html, text };
}
