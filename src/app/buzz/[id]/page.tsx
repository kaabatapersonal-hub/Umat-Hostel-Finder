import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

// Buzz is feed-only now -- there's no standalone post detail page to land
// on. Old bookmarked/shared links (including the ones ShareButton itself
// generates) still need to go somewhere real rather than 404, so this
// redirects into the feed with the post id carried as a query param; the
// feed page uses it to scroll to and briefly highlight that post if it's
// already loaded (best-effort, not guaranteed for an old paginated-away
// post -- see buzz/page.tsx).
export default async function BuzzPostRedirectPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/buzz?post=${id}`);
}
