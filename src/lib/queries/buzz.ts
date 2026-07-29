import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface BuzzPost {
  id: string;
  authorId: string;
  authorName: string | null;
  content: string;
  isAdminPost: boolean;
  isPinned: boolean;
  replyCount: number;
  likeCount: number;
  bookmarkCount: number;
  viewCount: number;
  createdAt: string;
}

const BUZZ_POST_COLUMNS =
  "id, author_id, author_name, content, is_admin_post, is_pinned, reply_count, like_count, bookmark_count, view_count, created_at";

interface BuzzPostRow {
  id: string;
  author_id: string;
  author_name: string | null;
  content: string;
  is_admin_post: boolean;
  is_pinned: boolean;
  reply_count: number;
  like_count: number;
  bookmark_count: number;
  view_count: number;
  created_at: string;
}

function mapBuzzPost(row: BuzzPostRow): BuzzPost {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    content: row.content,
    isAdminPost: row.is_admin_post,
    isPinned: row.is_pinned,
    replyCount: row.reply_count,
    likeCount: row.like_count,
    bookmarkCount: row.bookmark_count,
    viewCount: row.view_count,
    createdAt: row.created_at,
  };
}

export const BUZZ_PAGE_SIZE = 20;

export interface BuzzCursor {
  createdAt: string;
  id: string;
}

export interface GetBuzzFeedResult {
  posts: BuzzPost[];
  nextCursor: BuzzCursor | null;
}

// Keyset (cursor) pagination, not offset -- this feed only ever grows and
// is never filtered/searched, so a plain PostgREST .or() filter is enough
// (no need for the dedicated RPC get_hostel_feed uses, which exists to
// carry search/filter logic the database needs to evaluate). Pinned posts
// are excluded here and fetched separately (getPinnedBuzzPosts) so they
// never appear twice -- once pinned at the top, once again in their
// chronological slot.
export async function getBuzzFeed(
  supabase: SupabaseClient<Database>,
  { cursor, limit = BUZZ_PAGE_SIZE }: { cursor?: BuzzCursor | null; limit?: number } = {}
): Promise<GetBuzzFeedResult> {
  let query = supabase
    .from("buzz_posts")
    .select(BUZZ_POST_COLUMNS)
    .eq("is_pinned", false)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const posts = (data ?? []).map(mapBuzzPost);
  const last = posts[posts.length - 1];
  const nextCursor = posts.length === limit && last ? { createdAt: last.createdAt, id: last.id } : null;

  return { posts, nextCursor };
}

export interface HotBuzzCursor {
  score: number;
  createdAt: string;
  id: string;
}

export interface GetHotBuzzFeedResult {
  posts: BuzzPost[];
  nextCursor: HotBuzzCursor | null;
}

// Ranked by get_hot_buzz_posts' time-decay formula (see the migration for
// the exact expression and the reasoning behind its tiebreak) -- a real
// RPC, not a client-side sort, since the score depends on `now()` at query
// time. Same cursor-pagination shape as getBuzzFeed, just keyed on
// (score, createdAt, id) instead of (createdAt, id).
export async function getHotBuzzFeed(
  supabase: SupabaseClient<Database>,
  { cursor, limit = BUZZ_PAGE_SIZE }: { cursor?: HotBuzzCursor | null; limit?: number } = {}
): Promise<GetHotBuzzFeedResult> {
  const { data, error } = await supabase.rpc("get_hot_buzz_posts", {
    p_cursor_score: cursor?.score ?? null,
    p_cursor_created_at: cursor?.createdAt ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: limit,
  });

  if (error) throw error;

  const rows = data ?? [];
  const posts = rows.map(mapBuzzPost);
  const last = rows[rows.length - 1];
  const nextCursor =
    rows.length === limit && last ? { score: last.hot_score, createdAt: last.created_at, id: last.id } : null;

  return { posts, nextCursor };
}

// Capped at 3 by the enforce_buzz_pin_cap trigger -- this is always a
// small, cheap query, never part of the paginated cursor.
export async function getPinnedBuzzPosts(supabase: SupabaseClient<Database>): Promise<BuzzPost[]> {
  const { data, error } = await supabase
    .from("buzz_posts")
    .select(BUZZ_POST_COLUMNS)
    .eq("is_pinned", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapBuzzPost);
}

export async function getBuzzPostById(supabase: SupabaseClient<Database>, id: string): Promise<BuzzPost | null> {
  const { data, error } = await supabase.from("buzz_posts").select(BUZZ_POST_COLUMNS).eq("id", id).maybeSingle();

  if (error) {
    if (error.code === "22P02") return null;
    throw error;
  }
  return data ? mapBuzzPost(data) : null;
}

export async function createBuzzPost(
  supabase: SupabaseClient<Database>,
  { authorId, content }: { authorId: string; content: string }
): Promise<BuzzPost> {
  // author_name/is_admin_post are never sent -- protect_buzz_post_writes
  // resolves both server-side from the current profiles row.
  const { data, error } = await supabase
    .from("buzz_posts")
    .insert({ author_id: authorId, content })
    .select(BUZZ_POST_COLUMNS)
    .single();

  if (error) throw error;
  return mapBuzzPost(data);
}

export async function deleteBuzzPost(supabase: SupabaseClient<Database>, postId: string): Promise<void> {
  const { error } = await supabase.from("buzz_posts").delete().eq("id", postId);
  if (error) throw error;
}

export async function setBuzzPostPinned(
  supabase: SupabaseClient<Database>,
  postId: string,
  pinned: boolean
): Promise<void> {
  const { error } = await supabase.from("buzz_posts").update({ is_pinned: pinned }).eq("id", postId);
  if (error) throw error;
}

export interface BuzzReply {
  id: string;
  postId: string;
  authorId: string;
  authorName: string | null;
  content: string;
  // A reply is either text or a GIF, never both -- see the migration's
  // own comment on why the CHECK constraint enforces this at the
  // database level too, not just in the compose UI.
  gifUrl: string | null;
  createdAt: string;
}

const BUZZ_REPLY_COLUMNS = "id, post_id, author_id, author_name, content, gif_url, created_at";

interface BuzzReplyRow {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string | null;
  content: string;
  gif_url: string | null;
  created_at: string;
}

function mapBuzzReply(row: BuzzReplyRow): BuzzReply {
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    authorName: row.author_name,
    content: row.content,
    gifUrl: row.gif_url,
    createdAt: row.created_at,
  };
}

export const BUZZ_REPLIES_PAGE_SIZE = 20;

export interface GetBuzzRepliesResult {
  replies: BuzzReply[];
  nextOffset: number | null;
}

// Oldest first (a conversation reads top-to-bottom), plain offset paging --
// a single post's reply count stays small, same reasoning as reviews'
// per-hostel pagination.
export async function getBuzzReplies(
  supabase: SupabaseClient<Database>,
  postId: string,
  { offset = 0, limit = BUZZ_REPLIES_PAGE_SIZE }: { offset?: number; limit?: number } = {}
): Promise<GetBuzzRepliesResult> {
  const { data, error } = await supabase
    .from("buzz_replies")
    .select(BUZZ_REPLY_COLUMNS)
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const replies = (data ?? []).map(mapBuzzReply);
  const nextOffset = replies.length === limit ? offset + limit : null;

  return { replies, nextOffset };
}

export async function createBuzzReply(
  supabase: SupabaseClient<Database>,
  { postId, authorId, content, gifUrl }: { postId: string; authorId: string; content: string; gifUrl?: string | null }
): Promise<BuzzReply> {
  const { data, error } = await supabase
    .from("buzz_replies")
    .insert({ post_id: postId, author_id: authorId, content, gif_url: gifUrl ?? null })
    .select(BUZZ_REPLY_COLUMNS)
    .single();

  if (error) throw error;
  return mapBuzzReply(data);
}

export async function deleteBuzzReply(supabase: SupabaseClient<Database>, replyId: string): Promise<void> {
  const { error } = await supabase.from("buzz_replies").delete().eq("id", replyId);
  if (error) throw error;
}

export async function likeBuzzPost(supabase: SupabaseClient<Database>, postId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("buzz_likes").insert({ post_id: postId, user_id: userId });
  if (error) throw error;
}

export async function unlikeBuzzPost(supabase: SupabaseClient<Database>, postId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("buzz_likes").delete().eq("post_id", postId).eq("user_id", userId);
  if (error) throw error;
}

// Batched (one query for every post currently on screen), not one query
// per card -- same shape as get_verified_profiles/useVerifiedProfiles,
// which this same feed already calls the same way.
export async function getMyLikedPostIds(
  supabase: SupabaseClient<Database>,
  postIds: string[],
  userId: string
): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();

  const { data, error } = await supabase.from("buzz_likes").select("post_id").eq("user_id", userId).in("post_id", postIds);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.post_id));
}

export type BuzzReportReason = "inappropriate" | "spam" | "harassment" | "other";
export type BuzzReportStatus = "pending" | "reviewed" | "dismissed";

export async function reportBuzzItem(
  supabase: SupabaseClient<Database>,
  {
    reporterId,
    postId,
    replyId,
    reason,
    details,
  }: { reporterId: string; postId?: string | null; replyId?: string | null; reason: BuzzReportReason; details?: string | null }
): Promise<void> {
  const { error } = await supabase.from("buzz_reports").insert({
    reporter_id: reporterId,
    post_id: postId ?? null,
    reply_id: replyId ?? null,
    reason,
    details: details?.trim() || null,
  });
  if (error) throw error;
}

// Every report the caller has ever filed, split into two id sets -- lets
// the UI show "Reported" on any post/reply they've already flagged
// without a separate round trip per card. RLS only ever returns the
// caller's own rows here (or every row, for a moderator) -- see the
// migration's buzz_reports_select_own_or_moderator policy.
export interface MyBuzzReports {
  postIds: Set<string>;
  replyIds: Set<string>;
}

export async function getMyBuzzReports(supabase: SupabaseClient<Database>, userId: string): Promise<MyBuzzReports> {
  const { data, error } = await supabase.from("buzz_reports").select("post_id, reply_id").eq("reporter_id", userId);
  if (error) throw error;

  const postIds = new Set<string>();
  const replyIds = new Set<string>();
  for (const row of data ?? []) {
    if (row.post_id) postIds.add(row.post_id);
    if (row.reply_id) replyIds.add(row.reply_id);
  }
  return { postIds, replyIds };
}

export interface AdminBuzzReportRow {
  id: string;
  reporterId: string;
  reporterName: string | null;
  reason: BuzzReportReason;
  details: string | null;
  status: BuzzReportStatus;
  createdAt: string;
  targetType: "post" | "reply";
  // The post to navigate to either way -- the reported post itself, or
  // (for a reply report) the reply's parent post, so "View post" always
  // lands somewhere with the reported content visible in context.
  targetPostId: string | null;
  targetPreview: string;
}

// Admin-only screen, so this can read profiles/buzz_posts/buzz_replies
// directly (admins already have blanket read access to profiles; the
// other two tables are fully public-read) rather than needing a
// denormalized reporter name the way public-facing author_name is.
export async function getAdminBuzzReports(
  supabase: SupabaseClient<Database>,
  { status = "pending" }: { status?: BuzzReportStatus } = {}
): Promise<AdminBuzzReportRow[]> {
  const { data: reports, error } = await supabase
    .from("buzz_reports")
    .select("id, reporter_id, post_id, reply_id, reason, details, status, created_at")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!reports || reports.length === 0) return [];

  const reporterIds = [...new Set(reports.map((r) => r.reporter_id))];
  const postIds = [...new Set(reports.filter((r) => r.post_id).map((r) => r.post_id as string))];
  const replyIds = [...new Set(reports.filter((r) => r.reply_id).map((r) => r.reply_id as string))];

  const [profilesRes, postsRes, repliesRes] = await Promise.all([
    reporterIds.length ? supabase.from("profiles").select("id, full_name").in("id", reporterIds) : Promise.resolve({ data: [], error: null }),
    postIds.length ? supabase.from("buzz_posts").select("id, content").in("id", postIds) : Promise.resolve({ data: [], error: null }),
    replyIds.length
      ? supabase.from("buzz_replies").select("id, post_id, content, gif_url").in("id", replyIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesRes.error) throw profilesRes.error;
  if (postsRes.error) throw postsRes.error;
  if (repliesRes.error) throw repliesRes.error;

  const nameById = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name as string | null]));
  const postContentById = new Map((postsRes.data ?? []).map((p) => [p.id as string, p.content as string]));
  const replyById = new Map(
    (repliesRes.data ?? []).map((r) => [
      r.id as string,
      { postId: r.post_id as string, content: r.content as string, gifUrl: r.gif_url as string | null },
    ])
  );

  return reports.map((r) => {
    const isPost = !!r.post_id;
    const reply = r.reply_id ? replyById.get(r.reply_id) : undefined;

    return {
      id: r.id,
      reporterId: r.reporter_id,
      reporterName: nameById.get(r.reporter_id) ?? null,
      reason: r.reason as BuzzReportReason,
      details: r.details,
      status: r.status as BuzzReportStatus,
      createdAt: r.created_at,
      targetType: isPost ? "post" : "reply",
      targetPostId: isPost ? (r.post_id as string) : (reply?.postId ?? null),
      targetPreview: isPost
        ? (postContentById.get(r.post_id as string) ?? "(post deleted)")
        : reply
          ? reply.gifUrl
            ? "[GIF reply]"
            : reply.content
          : "(reply deleted)",
    };
  });
}

export async function getPendingBuzzReportsCount(supabase: SupabaseClient<Database>): Promise<number> {
  const { count, error } = await supabase.from("buzz_reports").select("*", { count: "exact", head: true }).eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

export async function resolveBuzzReport(
  supabase: SupabaseClient<Database>,
  reportId: string,
  action: "dismiss" | "delete"
): Promise<void> {
  const { error } = await supabase.rpc("resolve_buzz_report", { p_report_id: reportId, p_action: action });
  if (error) throw error;
}

// =========================================================================
// Bookmarks (Session A.5)
// =========================================================================

export async function bookmarkBuzzPost(supabase: SupabaseClient<Database>, postId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("buzz_bookmarks").insert({ post_id: postId, user_id: userId });
  if (error) throw error;
}

export async function unbookmarkBuzzPost(supabase: SupabaseClient<Database>, postId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("buzz_bookmarks").delete().eq("post_id", postId).eq("user_id", userId);
  if (error) throw error;
}

// Batched (one query for every post currently on screen), same shape as
// getMyLikedPostIds/getVerifiedProfiles -- never one query per card.
export async function getMyBookmarkedPostIds(
  supabase: SupabaseClient<Database>,
  postIds: string[],
  userId: string
): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();

  const { data, error } = await supabase.from("buzz_bookmarks").select("post_id").eq("user_id", userId).in("post_id", postIds);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.post_id));
}

export interface SavedBuzzCursor {
  createdAt: string;
  id: string;
}

export interface GetSavedBuzzPostsResult {
  posts: BuzzPost[];
  nextCursor: SavedBuzzCursor | null;
}

// Two-step (bookmarks, then a batched buzz_posts lookup), not an embedded
// PostgREST join -- same posture as getAdminBuzzReports: simpler to
// reason about, and doesn't depend on this project's hand-maintained
// Database types matching PostgREST's embedded-relationship shape
// exactly. Cursor is on the *bookmark's* created_at (when it was saved),
// not the post's -- "most recently saved first," per the brief.
export async function getSavedBuzzPosts(
  supabase: SupabaseClient<Database>,
  userId: string,
  { cursor, limit = BUZZ_PAGE_SIZE }: { cursor?: SavedBuzzCursor | null; limit?: number } = {}
): Promise<GetSavedBuzzPostsResult> {
  let bookmarksQuery = supabase
    .from("buzz_bookmarks")
    .select("id, post_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (cursor) {
    bookmarksQuery = bookmarksQuery.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
  }

  const { data: bookmarks, error: bookmarksError } = await bookmarksQuery;
  if (bookmarksError) throw bookmarksError;

  if (!bookmarks || bookmarks.length === 0) return { posts: [], nextCursor: null };

  const postIds = bookmarks.map((b) => b.post_id);
  const { data: postRows, error: postsError } = await supabase.from("buzz_posts").select(BUZZ_POST_COLUMNS).in("id", postIds);
  if (postsError) throw postsError;

  const postById = new Map((postRows ?? []).map((row) => [row.id, mapBuzzPost(row)]));
  // Preserve bookmark order (most recently saved first) -- not whatever
  // order the second query's IN clause happened to return rows in.
  const posts = bookmarks.map((b) => postById.get(b.post_id)).filter((p): p is BuzzPost => !!p);

  const last = bookmarks[bookmarks.length - 1];
  const nextCursor = bookmarks.length === limit && last ? { createdAt: last.created_at, id: last.id } : null;

  return { posts, nextCursor };
}

// =========================================================================
// View counts (Session A.5)
// =========================================================================

// No error is ever surfaced to the caller for this one on purpose -- a
// view count is a "nice to have" stat, not something that should ever
// interrupt or roll back the actual browsing experience if it fails.
// See use-track-buzz-post-view.ts, which fires this and ignores the
// result either way.
export async function incrementBuzzView(supabase: SupabaseClient<Database>, postId: string): Promise<void> {
  const { error } = await supabase.rpc("increment_buzz_view", { p_post_id: postId });
  if (error) throw error;
}
