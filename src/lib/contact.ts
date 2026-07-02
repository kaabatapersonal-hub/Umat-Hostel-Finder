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
