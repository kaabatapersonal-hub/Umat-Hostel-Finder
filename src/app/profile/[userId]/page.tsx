import { PublicProfileView } from "@/components/profile/public-profile-view";

type PageProps = { params: Promise<{ userId: string }> };

export default async function ProfilePage({ params }: PageProps) {
  const { userId } = await params;
  return <PublicProfileView userId={userId} />;
}
