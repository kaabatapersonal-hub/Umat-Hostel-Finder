// Progressive enhancement only -- most iOS browsers don't implement the
// Vibration API at all (Safari never has), and it can throw in some
// embedded/iframe contexts even where "vibrate" in navigator passes
// feature-detection. Never let this break a real interaction.
export function triggerHaptic(durationMs = 10): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(durationMs);
    }
  } catch {
    // Ignore -- see comment above.
  }
}
