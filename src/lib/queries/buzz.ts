import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Fixed set, not an open emoji picker -- fast to render, and the CHECK
// constraint on buzz_reactions.emoji is the real enforcement; this is
// just the UI's copy of the same 5 values.
export const BUZZ_REACTION_EMOJIS = ["🔥", "👍", "😂", "💯", "👀"] as const;
export type BuzzReactionEmoji = (typeof BUZZ_REACTION_EMOJIS)[number];

export interface BuzzPost {
  id: string;
  authorId: string;
  authorName: string | null;
  content: string;
  isAdminPost: boolean;
  isPinned: boolean;
  replyCount: number;
  reactionCounts: Partial<Record<BuzzReactionEmoji, number>>;
  createdAt: string;
}

const BUZZ_POST_COLUMNS =
  "id, author_id, author_name, content, is_admin_post, is_pinned, reply_count, reaction_counts, created_at";

interface BuzzPostRow {
  id: string;
  author_id: string;
  author_name: string | null;
  content: string;
  is_admin_post: boolean;
  is_pinned: boolean;
  reply_count: number;
  reaction_counts: unknown;
  created_at: string;
}

function parseReactionCounts(value: unknown): Partial<Record<BuzzReactionEmoji, number>> {
  if (!value || typeof value !== "object") return {};
  const counts: Partial<Record<BuzzReactionEmoji, number>> = {};
  for (const emoji of BUZZ_REACTION_EMOJIS) {
    const count = (value as Record<string, unknown>)[emoji];
    if (typeof count === "number" && count > 0) counts[emoji] = count;
  }
  return counts;
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
    reactionCounts: parseReactionCounts(row.reaction_counts),
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
  createdAt: string;
}

const BUZZ_REPLY_COLUMNS = "id, post_id, author_id, author_name, content, created_at";

interface BuzzReplyRow {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string | null;
  content: string;
  created_at: string;
}

function mapBuzzReply(row: BuzzReplyRow): BuzzReply {
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    authorName: row.author_name,
    content: row.content,
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
  { postId, authorId, content }: { postId: string; authorId: string; content: string }
): Promise<BuzzReply> {
  const { data, error } = await supabase
    .from("buzz_replies")
    .insert({ post_id: postId, author_id: authorId, content })
    .select(BUZZ_REPLY_COLUMNS)
    .single();

  if (error) throw error;
  return mapBuzzReply(data);
}

export async function deleteBuzzReply(supabase: SupabaseClient<Database>, replyId: string): Promise<void> {
  const { error } = await supabase.from("buzz_replies").delete().eq("id", replyId);
  if (error) throw error;
}

// Adds the reaction if the caller hasn't reacted with this emoji on this
// post yet, removes it if they have -- one round trip either way. Returns
// the new state (true = now reacted) for optimistic-UI reconciliation.
export async function toggleBuzzReaction(
  supabase: SupabaseClient<Database>,
  postId: string,
  emoji: BuzzReactionEmoji
): Promise<boolean> {
  const { data, error } = await supabase.rpc("toggle_buzz_reaction", { p_post_id: postId, p_emoji: emoji });
  if (error) throw error;
  return data;
}

// The caller's own reactions on one post -- lets the UI highlight which
// pills are "mine" without needing every other reactor's identity.
export async function getMyReactionsForPost(
  supabase: SupabaseClient<Database>,
  postId: string,
  userId: string
): Promise<BuzzReactionEmoji[]> {
  const { data, error } = await supabase
    .from("buzz_reactions")
    .select("emoji")
    .eq("post_id", postId)
    .eq("author_id", userId);

  if (error) throw error;
  return (data ?? []).map((row) => row.emoji as BuzzReactionEmoji);
}
