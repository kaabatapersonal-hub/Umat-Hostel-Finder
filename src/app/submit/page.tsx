"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PlusCircle, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonLine } from "@/components/ui/skeleton";
import { SubmitHostelForm, type SubmitFormMode } from "@/components/submit/submit-hostel-form";
import { useAuth } from "@/providers/auth-provider";
import { useSubmissionForEdit } from "@/hooks/use-submission-for-edit";
import { useHostel } from "@/hooks/use-hostel";
import type { EditableHostelFields } from "@/lib/hostel-fields";

function SubmitPageContent() {
  const { user, loading, requireAuth } = useAuth();
  const searchParams = useSearchParams();
  const submissionId = searchParams.get("submissionId");
  const hostelId = searchParams.get("hostelId");

  const submissionQuery = useSubmissionForEdit(submissionId);
  const hostelQuery = useHostel(hostelId ?? "", { enabled: !!hostelId });

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

  // Editing an existing pending submission.
  if (submissionId) {
    if (submissionQuery.isPending) {
      return (
        <div className="flex flex-col gap-3 px-4 pt-6">
          <SkeletonLine className="h-8 w-1/2" />
          <SkeletonLine className="h-32 w-full rounded-md" />
        </div>
      );
    }

    const submission = submissionQuery.data;
    if (!submission || submission.status !== "pending") {
      return (
        <div className="flex flex-col px-4 pt-6">
          <EmptyState
            icon={<AlertCircle className="size-7" strokeWidth={1.75} />}
            title="Can't edit this submission"
            description="It's either already been reviewed, or it isn't yours to edit."
            className="bg-surface shadow-card"
          />
        </div>
      );
    }

    const initialValues: EditableHostelFields = submission;
    const mode: SubmitFormMode = { kind: "edit-submission", submissionId: submission.id };

    return (
      <div className="flex flex-col">
        <PageHeader title="Edit Submission" subtitle="Still pending admin review" />
        <div className="px-4">
          <SubmitHostelForm mode={mode} initialValues={initialValues} />
        </div>
      </div>
    );
  }

  // Requesting an edit on an already-approved, live hostel.
  if (hostelId) {
    if (hostelQuery.isPending) {
      return (
        <div className="flex flex-col gap-3 px-4 pt-6">
          <SkeletonLine className="h-8 w-1/2" />
          <SkeletonLine className="h-32 w-full rounded-md" />
        </div>
      );
    }

    const hostel = hostelQuery.data;
    if (!hostel || hostel.ownerId !== user.id) {
      return (
        <div className="flex flex-col px-4 pt-6">
          <EmptyState
            icon={<AlertCircle className="size-7" strokeWidth={1.75} />}
            title="Can't edit this listing"
            description="This hostel doesn't exist, or you're not its owner."
            className="bg-surface shadow-card"
          />
        </div>
      );
    }

    const initialValues: EditableHostelFields = {
      name: hostel.name,
      location: hostel.location,
      distanceText: hostel.distanceText,
      description: hostel.description,
      roomTypes: hostel.roomTypes,
      images: hostel.images,
      facilities: hostel.facilities,
      contact: hostel.contact,
      callNumber: hostel.callNumber,
      latitude: hostel.latitude,
      longitude: hostel.longitude,
      tags: hostel.tags,
    };
    const mode: SubmitFormMode = { kind: "edit-hostel", hostelId: hostel.id, hasPendingEdit: hostel.hasPendingEdit };

    return (
      <div className="flex flex-col">
        <PageHeader title="Edit Listing" subtitle="Changes wait for admin approval before going live" />
        <div className="px-4">
          <SubmitHostelForm mode={mode} initialValues={initialValues} />
        </div>
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

export default function SubmitPage() {
  return (
    <Suspense fallback={null}>
      <SubmitPageContent />
    </Suspense>
  );
}
