import posthog from "posthog-js";

// Runs once, after the HTML loads but before React hydrates (Next.js
// 15.3+'s instrumentation-client convention) -- the right place to boot a
// client-side analytics SDK, and the only reliable way to hook every App
// Router navigation without a Suspense-wrapped pathname-watcher component,
// since onRouterTransitionStart below fires on every client-side
// navigation (push/replace/traverse) that a plain `capture_pageview: true`
// would miss entirely (that flag only fires on a real full page load,
// which the App Router almost never does after the first one).
//
// Optional by design, same posture as RESEND_API_KEY/KLIPY_API_KEY -- no
// key configured just means no analytics, never a broken app. See
// .env.local.example.
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    // Pageviews are captured manually below (initial load here, every
    // later navigation via onRouterTransitionStart) instead of relying on
    // PostHog's own automatic pageview/pageleave capture, which is tuned
    // for traditional multi-page sites.
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: "identified_only",
  });
  posthog.capture("$pageview");
}

export function onRouterTransitionStart(url: string) {
  if (!posthogKey) return;
  posthog.capture("$pageview", { $current_url: url });
}
