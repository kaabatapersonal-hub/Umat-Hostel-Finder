import posthog from "posthog-js";

// Progressive enhancement, same posture as haptics.ts/email.ts's missing-
// key handling -- NEXT_PUBLIC_POSTHOG_KEY is optional (see
// .env.local.example), and every call here must be a silent no-op without
// it rather than break the real action it's attached to (saving a hostel,
// posting to Buzz, signing up). Actual init + pageview tracking lives in
// src/instrumentation-client.ts, which runs once before hydration; this
// module is just the safe entry point every other component/hook calls
// through for custom events and identity.
function isEnabled(): boolean {
  return typeof window !== "undefined" && !!process.env.NEXT_PUBLIC_POSTHOG_KEY;
}

export function captureEvent(name: string, properties?: Record<string, unknown>): void {
  if (!isEnabled()) return;
  try {
    posthog.capture(name, properties);
  } catch {
    // Never let analytics take down a real interaction.
  }
}

// distinct_id is the Supabase user id, not the email -- PostHog's own
// person profile can carry the email as a property (opt-in per call site)
// without it being the identifier every event keys off.
export function identifyUser(userId: string, properties?: Record<string, unknown>): void {
  if (!isEnabled()) return;
  try {
    posthog.identify(userId, properties);
  } catch {
    // Ignore -- see isEnabled() comment above.
  }
}

// Called on sign-out -- otherwise the next person to sign in on a shared
// device would get folded into the previous user's PostHog identity.
export function resetIdentity(): void {
  if (!isEnabled()) return;
  try {
    posthog.reset();
  } catch {
    // Ignore -- see isEnabled() comment above.
  }
}
