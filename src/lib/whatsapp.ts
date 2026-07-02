// Normalizes a stored contact number to the digits-only international
// format wa.me requires (e.g. "233201234567" from "+233 20 000 0001" or
// "0200000001"). This is a defensive read-time normalization; the Submit
// form (Session 8) should validate/normalize numbers on the way in so
// storage is already clean and this becomes a no-op in the common case.
export function normalizePhoneForWhatsApp(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("233")) return digits;
  if (digits.startsWith("0")) return `233${digits.slice(1)}`;
  return digits;
}

export function buildWhatsAppLink(rawNumber: string, message: string): string {
  const number = normalizePhoneForWhatsApp(rawNumber);
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function buildHostelInquiryMessage(hostelName: string): string {
  return `Hi, I'm interested in ${hostelName} (via UMaT Hostel Finder)`;
}
