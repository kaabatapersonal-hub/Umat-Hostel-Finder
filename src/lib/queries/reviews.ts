import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface Review {
  id: string;
  hostelId: string;
  authorId: string;
  rating: number;
  comment: string;
  reviewerName: string | null;
  isResident: boolean;
  reported: boolean;
  createdAt: string;
  updatedAt: string;
}

const REVIEW_COLUMNS =
  "id, hostel_id, author_id, rating, comment, reviewer_name, is_resident, reported, created_at, updated_at";

interface ReviewRow {
  id: string;
  hostel_id: string;
  author_id: string;
  rating: number;
  comment: string;
  reviewer_name: string | null;
  is_resident: boolean;
  reported: boolean;
  created_at: string;
  updated_at: string;
}

function mapReview(row: ReviewRow): Review {
  return {
    id: row.id,
    hostelId: row.hostel_id,
    authorId: row.author_id,
    rating: row.rating,
    comment: row.comment,
    reviewerName: row.reviewer_name,
    isResident: row.is_resident,
    reported: row.reported,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const REVIEWS_PAGE_SIZE = 10;

export interface GetReviewsResult {
  reviews: Review[];
  nextOffset: number | null;
}

// Newest first, paginated with a simple offset — review counts per hostel
// are small (dozens, not thousands), so an offset range() is plenty; no
// need for the keyset-cursor machinery the main feed uses.
export async function getReviewsForHostel(
  supabase: SupabaseClient<Database>,
  hostelId: string,
  { offset = 0, limit = REVIEWS_PAGE_SIZE }: { offset?: number; limit?: number } = {}
): Promise<GetReviewsResult> {
  const { data, error } = await supabase
    .from("reviews")
    .select(REVIEW_COLUMNS)
    .eq("hostel_id", hostelId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const reviews = (data ?? []).map(mapReview);
  const nextOffset = reviews.length === limit ? offset + limit : null;

  return { reviews, nextOffset };
}

export async function getMyReviewForHostel(
  supabase: SupabaseClient<Database>,
  hostelId: string,
  userId: string
): Promise<Review | null> {
  const { data, error } = await supabase
    .from("reviews")
    .select(REVIEW_COLUMNS)
    .eq("hostel_id", hostelId)
    .eq("author_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapReview(data) : null;
}

// The honest resident signal (Session 7): resolved once, at post time, from
// whether the author actually has a saved_hostels row for this listing —
// never claimed as "verified", just an honest reflection of a real action.
async function hasSavedHostel(
  supabase: SupabaseClient<Database>,
  userId: string,
  hostelId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("saved_hostels")
    .select("id")
    .eq("user_id", userId)
    .eq("hostel_id", hostelId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export interface SubmitReviewInput {
  hostelId: string;
  authorId: string;
  rating: number;
  comment: string;
  reviewerName: string | null;
}

// Insert-only path: is_resident is resolved fresh from real data at the
// moment of posting and then stored, so rendering the list never needs an
// extra per-review join to know whether to show the badge.
export async function createReview(
  supabase: SupabaseClient<Database>,
  input: SubmitReviewInput
): Promise<Review> {
  const isResident = await hasSavedHostel(supabase, input.authorId, input.hostelId);

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      hostel_id: input.hostelId,
      author_id: input.authorId,
      rating: input.rating,
      comment: input.comment,
      reviewer_name: input.reviewerName,
      is_resident: isResident,
    })
    .select(REVIEW_COLUMNS)
    .single();

  if (error) throw error;
  return mapReview(data);
}

export interface UpdateReviewInput {
  reviewId: string;
  rating: number;
  comment: string;
  reviewerName: string | null;
}

// is_resident is deliberately left untouched on edit — it's a record of
// what was true when the review was first posted, not a live status.
export async function updateReview(
  supabase: SupabaseClient<Database>,
  input: UpdateReviewInput
): Promise<Review> {
  const { data, error } = await supabase
    .from("reviews")
    .update({
      rating: input.rating,
      comment: input.comment,
      reviewer_name: input.reviewerName,
    })
    .eq("id", input.reviewId)
    .select(REVIEW_COLUMNS)
    .single();

  if (error) throw error;
  return mapReview(data);
}

export async function deleteReview(supabase: SupabaseClient<Database>, reviewId: string): Promise<void> {
  const { error } = await supabase.from("reviews").delete().eq("id", reviewId);
  if (error) throw error;
}

// Any authenticated user can flag a review, but only through this RPC —
// see supabase/migrations/20260703140420_report_review_function.sql. It can
// only ever flip `reported` to true, so it doesn't need (and deliberately
// doesn't get) the author/admin-only UPDATE policy that protects the rest
// of a review's content.
export async function reportReview(supabase: SupabaseClient<Database>, reviewId: string): Promise<void> {
  const { error } = await supabase.rpc("report_review", { p_review_id: reviewId });
  if (error) throw error;
}
