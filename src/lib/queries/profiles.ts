import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface PublicProfile {
  username: string | null;
  bio: string | null;
  whatsappNumber: string | null;
  phoneNumber: string | null;
  avatarColor: string | null;
  isVerified: boolean;
  verificationLabel: string | null;
  createdAt: string;
}

// Mirrors getSellerPublicProfile's own posture exactly: a security-definer
// RPC, never email/role/admin fields, even though profiles_select_all
// would technically permit a direct select too -- one narrow, intentional
// surface for every public-facing profile read in the app.
export async function getPublicProfile(supabase: SupabaseClient<Database>, userId: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc("get_public_profile", { p_user_id: userId });
  if (error) throw error;
  const row = data?.[0];
  return row
    ? {
        username: row.username,
        bio: row.bio,
        whatsappNumber: row.whatsapp_number,
        phoneNumber: row.phone_number,
        avatarColor: row.avatar_color,
        isVerified: row.is_verified,
        verificationLabel: row.verification_label,
        createdAt: row.created_at,
      }
    : null;
}

export interface ProfileStats {
  reviewCount: number;
  listingCount: number;
  buzzPostCount: number;
}

// Backs milestone badges (src/lib/badges.ts) -- one round trip instead of
// three separate count queries against already-public tables (reviews,
// active market_listings, buzz_posts), same "narrow aggregate RPC"
// posture as get_active_users_count.
export async function getProfileStats(supabase: SupabaseClient<Database>, userId: string): Promise<ProfileStats> {
  const { data, error } = await supabase.rpc("get_profile_stats", { p_user_id: userId });
  if (error) throw error;
  const row = data?.[0];
  return {
    reviewCount: row?.review_count ?? 0,
    listingCount: row?.listing_count ?? 0,
    buzzPostCount: row?.buzz_post_count ?? 0,
  };
}

export interface UpdateProfileInput {
  username?: string | null;
  bio?: string | null;
  whatsappNumber?: string | null;
  phoneNumber?: string | null;
}

// Own-row update, straightforward -- profiles_update_own already permits
// this; no RPC needed since none of these fields are privilege-sensitive
// (unlike role/is_verified/admin_permissions, which have their own
// revert-on-unauthorized-change triggers).
export async function updateOwnProfile(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: UpdateProfileInput
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      username: input.username,
      bio: input.bio,
      whatsapp_number: input.whatsappNumber,
      phone_number: input.phoneNumber,
    })
    .eq("id", userId);
  if (error) throw error;
}
