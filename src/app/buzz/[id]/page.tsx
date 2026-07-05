import { PostDetailView } from "@/components/buzz/post-detail-view";

type PageProps = { params: Promise<{ id: string }> };

export default async function BuzzPostPage({ params }: PageProps) {
  const { id } = await params;
  return <PostDetailView postId={id} />;
}
