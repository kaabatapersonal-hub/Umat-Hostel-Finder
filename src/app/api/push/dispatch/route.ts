import { NextResponse } from "next/server";
import webpush from "web-push";
import { createStaticClient } from "@/lib/supabase/server";

// Called by a Supabase Database Webhook (configured once in the dashboard,
// see the app's own docs for this session) on every INSERT into
// notifications -- this is the one piece of the push pipeline that can't
// live in a SQL migration, since sending an actual push requires a real
// outbound HTTP call (web-push) that Postgres itself can't make.
//
// Two secrets gate this route, both required, neither a Supabase
// service-role key (this app deliberately has none anywhere, see
// SECURITY.md): PUSH_DISPATCH_SECRET checks the inbound call is genuinely
// from the configured webhook (not a random POST from the internet), and
// the same secret is passed on to get_push_subscriptions_for_user, which
// is the one thing in the database allowed to read another user's push
// endpoint (see that RPC's own comment in the migration for why).
interface WebhookPayload {
  type: "INSERT";
  table: string;
  record: {
    id: string;
    recipient_id: string;
    title: string;
    body: string | null;
    link_url: string | null;
    reference_type: string | null;
    reference_id: string | null;
  };
}

function notificationUrl(record: WebhookPayload["record"]): string {
  if (record.link_url) return record.link_url;
  if (record.reference_type === "buzz_post" || record.reference_type === "buzz_reply") {
    return record.reference_id ? `/buzz?post=${record.reference_id}` : "/buzz";
  }
  if (record.reference_type === "hostel" && record.reference_id) return `/hostel/${record.reference_id}`;
  return "/";
}

export async function POST(request: Request) {
  const secret = process.env.PUSH_DISPATCH_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "Push dispatch not configured" }, { status: 503 });
  }

  const incomingSecret = request.headers.get("x-webhook-secret");
  if (incomingSecret !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({ ok: false, error: "VAPID keys not configured" }, { status: 503 });
  }

  const payload = (await request.json().catch(() => null)) as WebhookPayload | null;
  if (!payload?.record?.recipient_id) {
    return NextResponse.json({ ok: false, error: "Malformed webhook payload" }, { status: 400 });
  }

  webpush.setVapidDetails("mailto:support@campa.app", vapidPublicKey, vapidPrivateKey);

  const supabase = createStaticClient();
  const { data: subscriptions, error } = await supabase.rpc("get_push_subscriptions_for_user", {
    p_user_id: payload.record.recipient_id,
    p_dispatch_secret: secret,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const pushPayload = JSON.stringify({
    title: payload.record.title,
    body: payload.record.body ?? "",
    url: notificationUrl(payload.record),
  });

  const results = await Promise.allSettled(
    (subscriptions ?? []).map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        pushPayload
      )
    )
  );

  // A 404/410 means the subscription is dead (uninstalled, cleared site
  // data, expired) -- clean it up so future dispatches don't keep paying
  // for a lookup that will never succeed again.
  const deadEndpoints = (subscriptions ?? []).filter((sub, i) => {
    const result = results[i];
    if (result.status !== "rejected") return false;
    const statusCode = (result.reason as { statusCode?: number })?.statusCode;
    return statusCode === 404 || statusCode === 410;
  });

  if (deadEndpoints.length > 0) {
    await supabase.rpc("delete_dead_push_subscriptions", {
      p_endpoints: deadEndpoints.map((s) => s.endpoint),
      p_dispatch_secret: secret,
    });
  }

  return NextResponse.json({ ok: true, sent: results.filter((r) => r.status === "fulfilled").length });
}
