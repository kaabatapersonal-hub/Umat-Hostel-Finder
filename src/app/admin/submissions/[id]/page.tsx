import { AdminSubmissionReviewView } from "@/components/admin/admin-submission-review-view";

export default async function AdminSubmissionReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminSubmissionReviewView id={id} />;
}
