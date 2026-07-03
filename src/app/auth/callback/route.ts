import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Magic-link landing point. Supabase's default flow sends a PKCE `code`
// param here; exchanging it via the cookie-bound server client is what
// actually writes the resulting session into cookies, not just returns it —
// skip this and the user looks "signed in" for one response and then isn't.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/?auth_error=1`);
}
