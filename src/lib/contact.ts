// Normalizes a stored contact number to the digits-only international
// format both wa.me and tel: expect (e.g. "233201234567" from
// "+233 20 000 0001" or "0200000001"). This is a defensive read-time
// normalization; the Submit form (Session 8) should validate/normalize
// both the WhatsApp number and call_number on the way in, so storage is
// already clean and this becomes a no-op in the common case.
export function normalizePhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("233")) return digits;
  if (digits.startsWith("0")) return `233${digits.slice(1)}`;
  return digits;
}

// A normalized Ghanaian mobile number is always "233" + 9 digits (12
// digits total) -- used by the Submit form to reject obviously-broken
// numbers before they ever reach wa.me/tel: links.
export function isValidPhoneNumber(raw: string): boolean {
  return /^233\d{9}$/.test(normalizePhoneNumber(raw));
}

export function formatDisplayPhoneNumber(raw: string): string {
  const normalized = normalizePhoneNumber(raw);
  if (normalized.length !== 12) return raw;
  return `+${normalized.slice(0, 3)} ${normalized.slice(3, 5)} ${normalized.slice(5, 8)} ${normalized.slice(8)}`;
}

export function buildWhatsAppLink(rawNumber: string, message: string): string {
  return `https://wa.me/${normalizePhoneNumber(rawNumber)}?text=${encodeURIComponent(message)}`;
}

export function buildTelLink(rawNumber: string): string {
  return `tel:+${normalizePhoneNumber(rawNumber)}`;
}

export function buildHostelInquiryMessage(hostelName: string): string {
  return `Hi, I'm interested in ${hostelName} (via UMaT Hostel Finder)`;
}

// contact/call_number are safe by construction (normalizePhoneNumber
// strips everything but digits before a URL is ever built from them), but
// whatsapp_group is a free-text URL column rendered directly as an
// anchor's href with no such normalization. Nothing in the app writes it
// today, but RLS is row-level, not column-level -- a direct API write (or
// a future form that forgets this check) could still land a
// `javascript:`/`data:` URL there, which would then execute in the app's
// own origin the moment someone taps "Join Group". Session 15 hardening:
// only ever render it if it's a plain https:// URL.
export function isSafeHttpUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

// Matches a Ghanaian mobile number embedded in free text -- "call
// 0231234567" or "+233 20 000 0001 for details" inside a Buzz post. Tuned
// for scanning a paragraph (lookaround guards against matching a slice of
// a longer digit run), unlike isValidPhoneNumber above which validates a
// whole dedicated form field. Only ever used to find candidate substrings
// to hand to normalizePhoneNumber/buildTelLink -- never rendered as raw
// HTML, so there's no injection surface here the way there is with
// arbitrary URLs.
const PHONE_IN_TEXT_REGEX = /(?<!\d)(?:\+?233\d{9}|0\d{9})(?!\d)/g;

export interface TextSegment {
  text: string;
  isPhoneNumber: boolean;
}

export function splitOutPhoneNumbers(content: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(PHONE_IN_TEXT_REGEX)) {
    const index = match.index ?? 0;
    if (index > lastIndex) segments.push({ text: content.slice(lastIndex, index), isPhoneNumber: false });
    segments.push({ text: match[0], isPhoneNumber: true });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < content.length) segments.push({ text: content.slice(lastIndex), isPhoneNumber: false });

  return segments;
}
