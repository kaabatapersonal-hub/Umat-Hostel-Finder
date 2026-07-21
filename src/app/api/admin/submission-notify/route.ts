import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, approvalEmailHtml, rejectionEmailHtml, getSiteUrl } from "@/lib/email";

interface NotifyBody {
  submissionId: string;
  action: "approved" | "rejected";
  hostelId?: string;
  adminNote?: string | null;
}

// Best-effort notification, called after approve_submission /
// reject_submission has already succeeded (Session 11) -- this route
// never decides whether the submission itself was approved/rejected, it
// only sends the email. Re-checks admin server-side rather than trusting
// the caller; the API key this needs lives only in this server route.
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as NotifyBody | null;
  if (!body?.submissionId || !body.action) {
    return NextResponse.json({ ok: false, error: "Missing submissionId or action" }, { status: 400 });
  }

  const { data: submission } = await supabase
    .from("submissions")
    .select("name, submitted_by")
    .eq("id", body.submissionId)
    .maybeSingle();

  if (!submission) {
    return NextResponse.json({ ok: false, error: "Submission not found" }, { status: 404 });
  }

  const { data: submitterProfile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", submission.submitted_by)
    .maybeSingle();

  if (!submitterProfile?.email) {
    return NextResponse.json({ ok: false, error: "Submitter has no email on file" });
  }

  if (body.action === "approved") {
    if (!body.hostelId) {
      return NextResponse.json({ ok: false, error: "Missing hostelId for approval email" }, { status: 400 });
    }
    const result = await sendEmail({
      to: submitterProfile.email,
      subject: `Your hostel listing "${submission.name}" is now live on Campa`,
      html: approvalEmailHtml({ hostelName: submission.name, hostelUrl: `${getSiteUrl()}/hostel/${body.hostelId}` }),
    });
    return NextResponse.json(result);
  }

  const result = await sendEmail({
    to: submitterProfile.email,
    subject: `Update on your hostel submission "${submission.name}"`,
    html: rejectionEmailHtml({ hostelName: submission.name, note: body.adminNote ?? null }),
  });
  return NextResponse.json(result);
}
