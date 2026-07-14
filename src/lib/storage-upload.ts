import type { SupabaseClient } from "@supabase/supabase-js";

export type StorageBucket = "hostel-images" | "room-images" | "market-images";

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

// The inverse of the above: pulls the storage path back out of a public
// URL so a removed image can actually be deleted, not just dropped from
// the array (the Session 5 orphan-cleanup loose end -- see ImageUploader's
// removeSlot). Returns null for anything that isn't a public URL from this
// bucket (defensive -- never try to delete an unrelated object).
export function extractStoragePath(bucket: StorageBucket, url: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return url.slice(index + marker.length);
}

export async function deleteImageFromStorage(
  supabase: SupabaseClient,
  bucket: StorageBucket,
  url: string
): Promise<void> {
  const path = extractStoragePath(bucket, url);
  if (!path) return;
  await supabase.storage.from(bucket).remove([path]);
}
