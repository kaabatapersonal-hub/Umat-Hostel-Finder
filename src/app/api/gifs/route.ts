import { NextResponse } from "next/server";
import type { GifResult } from "@/lib/queries/gifs";

// Server-only proxy to Klipy -- the API key lives in the URL path Klipy
// itself requires, which must never reach the browser. The client only
// ever calls this same-origin route, never api.klipy.com directly.
const KLIPY_BASE = "https://api.klipy.com/api/v1";
const RESULTS_PER_PAGE = 12;

interface KlipyGifItem {
  slug: string;
  title: string;
  files: { gif: { url: string }; tinygif: { url: string } };
}

interface KlipyResponse {
  result: boolean;
  data?: { data: KlipyGifItem[] };
}

export async function GET(request: Request) {
  const apiKey = process.env.KLIPY_API_KEY;
  if (!apiKey) {
    // Best-effort by design (same posture as email.ts's missing
    // RESEND_API_KEY) -- a missing key degrades to an empty result set,
    // never a hard error the reply UI would have to special-case.
    return NextResponse.json({ gifs: [] satisfies GifResult[] });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  const endpoint = query
    ? `${KLIPY_BASE}/${apiKey}/gifs/search?q=${encodeURIComponent(query)}&per_page=${RESULTS_PER_PAGE}&rating=pg`
    : `${KLIPY_BASE}/${apiKey}/gifs/trending?per_page=${RESULTS_PER_PAGE}`;

  try {
    const res = await fetch(endpoint);
    if (!res.ok) return NextResponse.json({ gifs: [] satisfies GifResult[] });

    const json = (await res.json()) as KlipyResponse;
    if (!json.result) return NextResponse.json({ gifs: [] satisfies GifResult[] });

    const gifs: GifResult[] = (json.data?.data ?? []).map((item) => ({
      id: item.slug,
      title: item.title,
      previewUrl: item.files.tinygif.url,
      fullUrl: item.files.gif.url,
    }));

    return NextResponse.json({ gifs });
  } catch {
    return NextResponse.json({ gifs: [] satisfies GifResult[] });
  }
}
