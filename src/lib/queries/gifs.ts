export interface GifResult {
  id: string;
  title: string;
  previewUrl: string;
  fullUrl: string;
}

// Hits this app's own /api/gifs route, never api.klipy.com directly --
// see that route's own comment on why the key can't live client-side.
// No query -> trending (the picker's pre-loaded state before anyone
// types anything).
export async function searchGifs(query: string): Promise<GifResult[]> {
  const url = query.trim() ? `/api/gifs?q=${encodeURIComponent(query.trim())}` : "/api/gifs";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Couldn't load GIFs");
  const json = (await res.json()) as { gifs: GifResult[] };
  return json.gifs;
}
