import { AdminEditHostelView } from "@/components/admin/admin-edit-hostel-view";

export default async function AdminEditHostelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminEditHostelView id={id} />;
}
