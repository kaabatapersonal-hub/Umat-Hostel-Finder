"use client";

import { AlertCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SubmitHostelForm } from "@/components/submit/submit-hostel-form";
import { SubmissionReviewActions } from "./submission-review-actions";
import { useAdminSubmissionDetail } from "@/hooks/use-admin-submission-detail";
import { formatRelativeTime } from "@/lib/utils";

const STATUS_BADGE: Record<string, { label: string; variant: "filling" | "available" | "full" }> = {
  pending: { label: "Pending", variant: "filling" },
  approved: { label: "Approved", variant: "available" },
  rejected: { label: "Rejected", variant: "full" },
};

export function AdminSubmissionReviewView({ id }: { id: string }) {
  const { data: submission, isPending, isError, refetch } = useAdminSubmissionDetail(id);

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !submission) {
    return (
      <EmptyState
        icon={<AlertCircle className="size-7" strokeWidth={1.75} />}
        title={isError ? "Couldn't load this submission" : "Submission not found"}
        description={isError ? "Check your connection and try again." : "It may have already been withdrawn."}
        actionLabel={isError ? "Retry" : undefined}
        onAction={isError ? () => refetch() : undefined}
        className="bg-surface shadow-card"
      />
    );
  }

  const statusBadge = STATUS_BADGE[submission.status] ?? STATUS_BADGE.pending;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-h1 text-ink-900">Review: {submission.name}</h1>
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
        </div>
        <p className="text-body-sm text-ink-500">
          Submitted by {submission.submitterName || submission.submitterEmail || "an unknown user"} ·{" "}
          {formatRelativeTime(submission.createdAt)}
          {submission.submitterEmail && submission.submitterName && ` · ${submission.submitterEmail}`}
        </p>
        {submission.adminNote && (
          <p className="text-caption text-ink-500">Previous note: {submission.adminNote}</p>
        )}
      </div>

      {submission.status === "pending" ? (
        <SubmissionReviewActions submissionId={submission.id} />
      ) : (
        <div className="rounded-lg bg-surface-muted p-3 text-body-sm text-ink-500">
          This submission has already been {submission.status}. You can still view what was submitted below.
        </div>
      )}

      <SubmitHostelForm mode={{ kind: "admin-edit-submission", submissionId: submission.id }} initialValues={submission} />
    </div>
  );
}
