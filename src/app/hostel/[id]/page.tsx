import type { Metadata } from "next";
import { getCachedHostelById } from "@/lib/queries/hostel-details-cached";
import { HostelDetailsView } from "@/components/hostel-details/hostel-details-view";
import type { HostelDetails } from "@/lib/queries/hostels";

export const revalidate = 60;

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const hostel = await getCachedHostelById(id).catch(() => null);
  if (!hostel) return { title: "Hostel" };

  return {
    title: hostel.name,
    description: hostel.description || `${hostel.name} in ${hostel.location} — near UMaT, Tarkwa.`,
  };
}

export default async function HostelDetailsPage({ params }: PageProps) {
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
