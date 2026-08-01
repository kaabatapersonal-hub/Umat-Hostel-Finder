import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface SellerReview {
  id: string;
  sellerId: string;
  authorId: string;
  rating: number;
  comment: string;
  reviewerName: string | null;
  reported: boolean;
  createdAt: string;
  updatedAt: string;
}

const SELLER_REVIEW_COLUMNS = "id, seller_id, author_id, rating, comment, reviewer_name, reported, created_at, updated_at";

interface SellerReviewRow {
  id: string;
  seller_id: string;
  author_id: string;
  rating: number;
  comment: string;
  reviewer_name: string | null;
  reported: boolean;
  created_at: string;
  updated_at: string;
}

function mapSellerReview(row: SellerReviewRow): SellerReview {
  return {
    id: row.id,
    sellerId: row.seller_id,
    authorId: row.author_id,
    rating: row.rating,
    comment: row.comment,
    reviewerName: row.reviewer_name,
    reported: row.reported,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const SELLER_REVIEWS_PAGE_SIZE = 10;

export interface GetSellerReviewsResult {
  reviews: SellerReview[];
  nextOffset: number | null;
}

export async function getReviewsForSeller(
  supabase: SupabaseClient<Database>,
  sellerId: string,
  { offset = 0, limit = SELLER_REVIEWS_PAGE_SIZE }: { offset?: number; limit?: number } = {}
): Promise<GetSellerReviewsResult> {
  const { data, error } = await supabase
    .from("seller_reviews")
    .select(SELLER_REVIEW_COLUMNS)
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const reviews = (data ?? []).map(mapSellerReview);
  const nextOffset = reviews.length === limit ? offset + limit : null;

  return { reviews, nextOffset };
}

export async function getMyReviewForSeller(
  supabase: SupabaseClient<Database>,
  sellerId: string,
  authorId: string
): Promise<SellerReview | null> {
  const { data, error } = await supabase
    .from("seller_reviews")
    .select(SELLER_REVIEW_COLUMNS)
    .eq("seller_id", sellerId)
    .eq("author_id", authorId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapSellerReview(data) : null;
}

export interface SubmitSellerReviewInput {
  sellerId: string;
  authorId: string;
  rating: number;
  comment: string;
  reviewerName: string | null;
}

// No honest-badge resolution here, unlike createReview -- see the
// migration's own comment on why seller reviews deliberately have no
// "verified buyer" equivalent to is_resident (no transaction record
// exists to check against, WhatsApp handoff means the app never sees
// whether a sale happened).
export async function createSellerReview(
  supabase: SupabaseClient<Database>,
  input: SubmitSellerReviewInput
): Promise<SellerReview> {
  const { data, error } = await supabase
    .from("seller_reviews")
    .insert({
      seller_id: input.sellerId,
      author_id: input.authorId,
      rating: input.rating,
      comment: input.comment,
      reviewer_name: input.reviewerName,
    })
    .select(SELLER_REVIEW_COLUMNS)
    .single();

  if (error) throw error;
  return mapSellerReview(data);
}

export interface UpdateSellerReviewInput {
  reviewId: string;
  rating: number;
  comment: string;
  reviewerName: string | null;
}

export async function updateSellerReview(
  supabase: SupabaseClient<Database>,
  input: UpdateSellerReviewInput
): Promise<SellerReview> {
  const { data, error } = await supabase
    .from("seller_reviews")
    .update({
      rating: input.rating,
      comment: input.comment,
      reviewer_name: input.reviewerName,
    })
    .eq("id", input.reviewId)
    .select(SELLER_REVIEW_COLUMNS)
    .single();

  if (error) throw error;
  return mapSellerReview(data);
}

export async function deleteSellerReview(supabase: SupabaseClient<Database>, reviewId: string): Promise<void> {
  const { error } = await supabase.from("seller_reviews").delete().eq("id", reviewId);
  if (error) throw error;
}

export async function reportSellerReview(supabase: SupabaseClient<Database>, reviewId: string): Promise<void> {
  const { error } = await supabase.rpc("report_seller_review", { p_review_id: reviewId });
  if (error) throw error;
}
