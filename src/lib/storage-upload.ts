import type { SupabaseClient } from "@supabase/supabase-js";

export type StorageBucket = "hostel-images" | "room-images";

function randomFileName(): string {
  const id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${id}.webp`;
}

// Uploads an already-compressed blob to Supabase Storage and returns its
// public URL. Storage RLS (see Session 2 migrations) requires an
// authenticated caller for inserts; public reads don't need auth.
export async function uploadImageToStorage(
  supabase: SupabaseClient,
  bucket: StorageBucket,
  blob: Blob
): Promise<string> {
  const path = randomFileName();

  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
