import { getCachedHostelById } from "@/lib/queries/hostel-details-cached";
import { HostelDetailsView } from "@/components/hostel-details/hostel-details-view";
import type { HostelDetails } from "@/lib/queries/hostels";

export const revalidate = 60;

export default async function HostelDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let initialHostel: HostelDetails | null | undefined;
  try {
    initialHostel = await getCachedHostelById(id);
  } catch {
    // Don't fail the whole page if Supabase is unreachable — leave it
    // undefined so the client performs its own fetch and shows the real
    // loading/error state instead of a page crash.
    initialHostel = undefined;
  }

  return <HostelDetailsView id={id} initialHostel={initialHostel} />;
}
