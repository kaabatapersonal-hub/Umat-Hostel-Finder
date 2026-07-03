"use client";

import { ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/providers/auth-provider";

export default function AdminPage() {
  const { profile, loading } = useAuth();

  if (loading) return null;

  if (profile?.role !== "admin") {
    return (
      <div className="flex flex-col px-4 pt-6">
        <EmptyState
          icon={<ShieldCheck className="size-7" strokeWidth={1.75} />}
          title="Admin access only"
          description="This area is for UMaT Hostel Finder admins."
          className="bg-surface shadow-card"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col px-4 pt-6">
      <EmptyState
        icon={<ShieldCheck className="size-7" strokeWidth={1.75} />}
        title="Admin panel — coming in Sessions 10–11"
        description="Submission review, hostel management, and moderation tools land here."
        className="bg-surface shadow-card"
      />
    </div>
  );
}
