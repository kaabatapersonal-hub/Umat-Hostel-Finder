import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProfileRole } from "@/lib/supabase/database.types";

export interface AdminUserRow {
  id: string;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: ProfileRole;
  isSuspended: boolean;
  createdAt: string;
  reviewCount: number;
  saveCount: number;
  submissionCount: number;
  ownedHostelCount: number;
}

const ADMIN_USERS_PAGE_SIZE = 20;

export type AdminUserRoleFilter = "all" | "admin" | "student";
export type AdminUserSort = "newest" | "oldest";

export interface GetAdminUsersResult {
  users: AdminUserRow[];
  nextOffset: number | null;
}

// PostgREST's .or() takes a raw filter-syntax string -- strip characters
// that would otherwise be parsed as filter grammar rather than literal
// search text, so a comma or paren in someone's typed search doesn't throw
// off the whole query.
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()%]/g, "").trim();
}

// Offset pagination, same pattern as every other admin list (see
// admin-hostels.ts) -- an internal tool, not the public feed. Activity
// counts come from get_user_activity_counts, one RPC round trip for the
// whole page rather than N+1 queries or transferring full rows just to
// count them (there's no GROUP BY support via plain PostgREST calls).
export async function getAdminUsers(
  supabase: SupabaseClient<Database>,
  {
    search,
    roleFilter = "all",
    sort = "newest",
    offset = 0,
    limit = ADMIN_USERS_PAGE_SIZE,
  }: {
    search?: string;
    roleFilter?: AdminUserRoleFilter;
    sort?: AdminUserSort;
    offset?: number;
    limit?: number;
  } = {}
): Promise<GetAdminUsersResult> {
  let query = supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, role, is_suspended, created_at")
    .order("created_at", { ascending: sort === "oldest" })
    .range(offset, offset + limit - 1);

  if (roleFilter !== "all") query = query.eq("role", roleFilter);

  const term = search ? sanitizeSearchTerm(search) : "";
  if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);

  const { data, error } = await query;
  if (error) throw error;

  const rows = data ?? [];
  const ids = rows.map((row) => row.id);

  const countMap = new Map<
    string,
    { reviewCount: number; saveCount: number; submissionCount: number; ownedHostelCount: number }
  >();
  if (ids.length > 0) {
    const { data: counts, error: countsError } = await supabase.rpc("get_user_activity_counts", { p_user_ids: ids });
    if (countsError) throw countsError;
    for (const row of counts ?? []) {
      countMap.set(row.user_id, {
        reviewCount: row.review_count,
        saveCount: row.save_count,
        submissionCount: row.submission_count,
        ownedHostelCount: row.owned_hostel_count,
      });
    }
  }

  const users: AdminUserRow[] = rows.map((row) => {
    const counts = countMap.get(row.id);
    return {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      avatarUrl: row.avatar_url,
      role: (row.role as ProfileRole) ?? "student",
      isSuspended: row.is_suspended,
      createdAt: row.created_at,
      reviewCount: counts?.reviewCount ?? 0,
      saveCount: counts?.saveCount ?? 0,
      submissionCount: counts?.submissionCount ?? 0,
      ownedHostelCount: counts?.ownedHostelCount ?? 0,
    };
  });

  return { users, nextOffset: users.length === limit ? offset + limit : null };
}

export interface AdminUserReviewRow {
  id: string;
  hostelId: string;
  hostelName: string | null;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface AdminUserSavedHostelRow {
  id: string;
  hostelId: string;
  hostelName: string | null;
}

export interface AdminUserSubmissionRow {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

export interface AdminUserOwnedHostelRow {
  id: string;
  name: string;
  availability: string;
}

export interface AdminUserDetail {
  id: string;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: ProfileRole;
  isSuspended: boolean;
  createdAt: string;
  reviews: AdminUserReviewRow[];
  savedHostels: AdminUserSavedHostelRow[];
  submissions: AdminUserSubmissionRow[];
  ownedHostels: AdminUserOwnedHostelRow[];
}

// Not paginated -- a single student's reviews/saves/submissions/owned
// hostels stay small (dozens at most), and per-user analytics beyond a
// simple list are explicitly out of scope for this session.
export async function getAdminUserDetail(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<AdminUserDetail | null> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, role, is_suspended, created_at")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    if (profileError.code === "22P02") return null;
    throw profileError;
  }
  if (!profile) return null;

  const [reviewsRes, savesRes, submissionsRes, ownedRes] = await Promise.all([
    supabase
      .from("reviews")
      .select("id, hostel_id, rating, comment, created_at")
      .eq("author_id", userId)
      .order("created_at", { ascending: false }),
    supabase.from("saved_hostels").select("id, hostel_id").eq("user_id", userId),
    supabase
      .from("submissions")
      .select("id, name, status, created_at")
      .eq("submitted_by", userId)
      .order("created_at", { ascending: false }),
    supabase.from("hostels").select("id, name, availability").eq("owner_id", userId),
  ]);

  for (const result of [reviewsRes, savesRes, submissionsRes, ownedRes]) {
    if (result.error) throw result.error;
  }

  const reviewRows = reviewsRes.data ?? [];
  const saveRows = savesRes.data ?? [];

  // In-memory join to hostels for names (same reasoning as
  // admin-submissions.ts/admin-reviews.ts): this hand-maintained Database
  // type doesn't model relationship metadata the way a codegen'd one would.
  const hostelIds = [...new Set([...reviewRows.map((r) => r.hostel_id), ...saveRows.map((s) => s.hostel_id)])];
  const hostelNameMap = new Map<string, string>();
  if (hostelIds.length > 0) {
    const { data: hostels, error: hostelsError } = await supabase.from("hostels").select("id, name").in("id", hostelIds);
    if (hostelsError) throw hostelsError;
    for (const hostel of hostels ?? []) hostelNameMap.set(hostel.id, hostel.name);
  }

  return {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    avatarUrl: profile.avatar_url,
    role: (profile.role as ProfileRole) ?? "student",
    isSuspended: profile.is_suspended,
    createdAt: profile.created_at,
    reviews: reviewRows.map((r) => ({
      id: r.id,
      hostelId: r.hostel_id,
      hostelName: hostelNameMap.get(r.hostel_id) ?? null,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at,
    })),
    savedHostels: saveRows.map((s) => ({
      id: s.id,
      hostelId: s.hostel_id,
      hostelName: hostelNameMap.get(s.hostel_id) ?? null,
    })),
    submissions: (submissionsRes.data ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      createdAt: s.created_at,
    })),
    ownedHostels: (ownedRes.data ?? []).map((h) => ({
      id: h.id,
      name: h.name,
      availability: h.availability,
    })),
  };
}

// Promote/demote and suspend/unsuspend both go through RPCs, not a plain
// .update() -- there's no RLS policy letting an admin write a *different*
// user's profiles row directly (only the self-only profiles_update_own),
// and the RPCs also carry the self-demotion/self-suspension guards.
export async function setUserRole(supabase: SupabaseClient<Database>, userId: string, role: ProfileRole): Promise<void> {
  const { error } = await supabase.rpc("set_user_role", { p_user_id: userId, p_role: role });
  if (error) throw error;
}

export async function setUserSuspended(supabase: SupabaseClient<Database>, userId: string, suspended: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_user_suspended", { p_user_id: userId, p_suspended: suspended });
  if (error) throw error;
}

// For the "one account, several abusive reviews" cleanup case -- deletes
// every review by this user in one statement rather than one-by-one.
export async function deleteUserReviews(supabase: SupabaseClient<Database>, userId: string): Promise<number> {
  const { data, error } = await supabase.rpc("delete_user_reviews", { p_user_id: userId });
  if (error) throw error;
  return data ?? 0;
}
