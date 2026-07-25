import type { AdminPermission } from "@/lib/supabase/database.types";

// Friendly labels for the promote dialog's checkbox list and anywhere
// else a permission needs to read as a sentence, not a snake_case key.
// 'manage_admins' is deliberately absent -- see AdminPermission's own
// comment on why it's never actually assignable.
export const PERMISSION_OPTIONS: { value: AdminPermission; label: string; description: string }[] = [
  { value: "manage_hostels", label: "Manage hostels", description: "Add, edit, approve submissions and edit requests" },
  { value: "moderate_buzz", label: "Moderate Buzz", description: "Delete/pin posts and replies" },
  { value: "moderate_reviews", label: "Moderate reviews", description: "Delete reported reviews" },
  { value: "moderate_market", label: "Moderate marketplace", description: "Delete listings, toggle the marketplace flag" },
  { value: "manage_users", label: "Manage users", description: "View, verify, suspend (not promote/demote)" },
];

// Structurally typed (not importing Profile from auth-provider) to avoid
// a lib -> providers dependency for what's really just two fields.
// Super admin implicitly has every permission; the RLS/RPC layer is the
// real enforcement either way -- this only decides what the UI shows.
export function hasAdminPermission(
  profile: { isSuperAdmin: boolean; adminPermissions: AdminPermission[] } | null | undefined,
  permission: AdminPermission
): boolean {
  if (!profile) return false;
  return profile.isSuperAdmin || profile.adminPermissions.includes(permission);
}
