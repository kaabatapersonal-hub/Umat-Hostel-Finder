"use client";

import { PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SubmitHostelForm } from "@/components/submit/submit-hostel-form";
import { useAuth } from "@/providers/auth-provider";

export default function SubmitPage() {
  const { user, loading, requireAuth } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <div className="flex flex-col">
        <PageHeader title="Submit a Hostel" subtitle="Sign in to add your listing" />
        <EmptyState
          icon={<PlusCircle className="size-7" strokeWidth={1.75} />}
          title="Sign in to submit a hostel"
          description="Submissions are tied to your account so you can track their review status and manage the listing later."
          actionLabel="Sign In"
          onAction={() => requireAuth(() => {})}
          className="mx-4 mt-4 bg-surface shadow-card"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <PageHeader title="Submit a Hostel" subtitle="An admin reviews every listing before it goes live" />
      <div className="px-4">
        <SubmitHostelForm />
      </div>
    </div>
  );
}
