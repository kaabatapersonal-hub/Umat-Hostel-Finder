import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

// Cookie-bound client for Server Components / Route Handlers / Server
// Actions — carries the current user's session, so RLS sees auth.uid().
// Create a fresh one per request; never module-cache this.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component render, which can't set cookies.
            // Fine as long as a middleware refreshes the session elsewhere.
          }
        },
      },
    }
  );
}

// Stateless anon client — no cookies, no per-user session. For data that's
// public regardless of who's asking (e.g. the default hostel feed), so it
// can safely sit behind a shared Next.js cache (unstable_cache) instead of
// being tied to one request's cookie jar.
export function createStaticClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
