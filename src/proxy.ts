import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 renamed the middleware file convention to `proxy` (same
// mechanism, new name/export). This is what makes sessions actually persist
// in the App Router: the access token in the cookie is usually expired by
// the time a request reaches the server, so something has to use the
// refresh token and write the new access token back as a Set-Cookie before
// any Server Component reads it. Skipping this step is the classic "why am
// I logged out again" bug.
export default async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    }
  );

  // Do not add logic between createServerClient and getUser() — and do not
  // remove this call. It's what triggers the refresh; without it, the
  // session silently goes stale.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
