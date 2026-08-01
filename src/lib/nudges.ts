// Session-scoped (sessionStorage, not localStorage) nudge tracking -- the
// "3+ hostels browsed" banner and its dismissal should both reset the
// next time someone opens a fresh browser session, not follow them
// around forever the way an actually-installed-app flag should.
const VIEWED_HOSTELS_KEY = "campa-nudge-viewed-hostels";
const NUDGE_DISMISSED_KEY = "campa-nudge-dismissed";
const BROWSING_NUDGE_THRESHOLD = 3;

function readViewedHostels(): string[] {
  try {
    const raw = sessionStorage.getItem(VIEWED_HOSTELS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Private-browsing/quota edge cases -- a missed nudge isn't worth
    // breaking the page over.
    return [];
  }
}

export function trackHostelView(hostelId: string): void {
  if (typeof window === "undefined") return;
  try {
    const viewed = readViewedHostels();
    if (!viewed.includes(hostelId)) {
      viewed.push(hostelId);
      sessionStorage.setItem(VIEWED_HOSTELS_KEY, JSON.stringify(viewed));
    }
  } catch {
    // Ignore -- see readViewedHostels.
  }
}

// One nudge per session is enough -- once dismissed (or already shown),
// this stays false for the rest of the session regardless of how many
// more hostels get viewed.
export function shouldShowBrowsingNudge(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(NUDGE_DISMISSED_KEY) === "1") return false;
    return readViewedHostels().length >= BROWSING_NUDGE_THRESHOLD;
  } catch {
    return false;
  }
}

export function dismissBrowsingNudge(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(NUDGE_DISMISSED_KEY, "1");
  } catch {
    // Ignore.
  }
}

// Unlike the browsing nudge above, "you don't have a username yet" is a
// real, persistent account fact, not a one-off session heuristic -- the
// dismiss is still session-scoped (don't nag on every single page load),
// but deliberately reappears next session for as long as profile.username
// actually stays null, rather than being permanently silenced by one
// dismiss the way an install prompt would be.
const USERNAME_NUDGE_DISMISSED_KEY = "campa-nudge-username-dismissed";

export function shouldShowUsernameNudge(hasUsername: boolean): boolean {
  if (typeof window === "undefined") return false;
  if (hasUsername) return false;
  try {
    return sessionStorage.getItem(USERNAME_NUDGE_DISMISSED_KEY) !== "1";
  } catch {
    return false;
  }
}

export function dismissUsernameNudge(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(USERNAME_NUDGE_DISMISSED_KEY, "1");
  } catch {
    // Ignore.
  }
}
