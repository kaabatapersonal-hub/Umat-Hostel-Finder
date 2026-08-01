export const USERNAME_MAX_LENGTH = 30;
export const USERNAME_PATTERN = /^[a-zA-Z0-9_ ]+$/;

// Mirrors the CHECK constraint on profiles.username exactly -- shared so
// signup (auth-sheet.tsx) and profile editing never drift out of sync
// with what the database actually accepts. A username that fails this
// client-side gets a real inline error instead of the update silently
// hitting the DB's check constraint and surfacing as a generic
// "Couldn't save your profile" toast.
export function usernameError(trimmed: string): string | null {
  if (!trimmed) return null;
  if (trimmed.length > USERNAME_MAX_LENGTH) return "Keep it under 30 characters";
  if (!USERNAME_PATTERN.test(trimmed)) return "Letters, numbers, spaces, and underscores only";
  return null;
}
