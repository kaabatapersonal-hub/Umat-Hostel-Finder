import "server-only";

// Server-only by construction (the "server-only" import above makes this
// module a build error if anything client-side ever imports it) -- the
// Resend API key must never reach the browser. Called from the
// /api/admin/submission-notify route, never directly from a client
// component.

export interface SendEmailResult {
  ok: boolean;
  error?: string;
}

async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Best-effort by design (Session 11): the submission action itself
    // already succeeded by the time this runs. A missing key just means
    // no email goes out -- it must never surface as a failure of the
    // approve/reject action itself.
    return { ok: false, error: "RESEND_API_KEY is not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "UMaT Hostel Finder <onboarding@resend.dev>",
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { ok: false, error: `Resend responded ${response.status}: ${text.slice(0, 300)}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error sending email" };
  }
}

export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function emailShell(bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, Segoe UI, Inter, Arial, sans-serif; background: #f6f8f7; padding: 24px 16px;">
      <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden;">
        <div style="background: #0E4A34; padding: 20px 24px;">
          <span style="color: #E8A33D; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;">UMaT · Tarkwa</span>
          <div style="color: #ffffff; font-size: 20px; font-weight: 700; margin-top: 4px;">UMaT Hostel Finder</div>
        </div>
        <div style="padding: 24px; color: #16211C; font-size: 15px; line-height: 1.6;">
          ${bodyHtml}
        </div>
      </div>
    </div>
  `;
}

export function approvalEmailHtml({ hostelName, hostelUrl }: { hostelName: string; hostelUrl: string }): string {
  return emailShell(`
    <h1 style="font-size: 18px; margin: 0 0 12px;">Your listing is live! 🎉</h1>
    <p style="margin: 0 0 12px;">Good news — <strong>${hostelName}</strong> has been reviewed and approved. It's now visible to every UMaT student searching for a hostel.</p>
    <p style="margin: 0 0 20px;">
      <a href="${hostelUrl}" style="display: inline-block; background: #E8A33D; color: #16211C; font-weight: 600; padding: 10px 20px; border-radius: 999px; text-decoration: none;">View your listing</a>
    </p>
    <p style="margin: 0 0 12px;">Share the link with students looking for housing near campus — the sooner they find it, the sooner rooms fill up.</p>
    <p style="margin: 0; color: #667069;">— UMaT Hostel Finder</p>
  `);
}

export function rejectionEmailHtml({ hostelName, note }: { hostelName: string; note: string | null }): string {
  return emailShell(`
    <h1 style="font-size: 18px; margin: 0 0 12px;">About your submission</h1>
    <p style="margin: 0 0 12px;">Thanks for submitting <strong>${hostelName}</strong> to UMaT Hostel Finder. After review, we weren't able to approve it this time.</p>
    ${
      note
        ? `<p style="margin: 0 0 12px; padding: 12px 14px; background: #f6f8f7; border-radius: 8px;"><strong>Reviewer's note:</strong> ${note}</p>`
        : ""
    }
    <p style="margin: 0 0 12px;">This is usually easy to fix — double-check the pricing is accurate, add a few clear photos, and make sure the WhatsApp number is correct. You're welcome to submit again any time.</p>
    <p style="margin: 0; color: #667069;">— UMaT Hostel Finder</p>
  `);
}

export { sendEmail };
