"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useApproveSubmission } from "@/hooks/use-approve-submission";
import { useRejectSubmission } from "@/hooks/use-reject-submission";

export function SubmissionReviewActions({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const approve = useApproveSubmission();
  const reject = useRejectSubmission();

  function handleApprove() {
    approve.mutate(submissionId, { onSuccess: () => router.push("/admin/submissions") });
  }

  function handleReject() {
    reject.mutate(
      { submissionId, adminNote: note.trim() || null },
      { onSuccess: () => router.push("/admin/submissions") }
    );
  }

  if (rejecting) {
    return (
      <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card">
        <Textarea
          label="Reason (optional — included in the email to the submitter)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="e.g. Photos are too blurry — please retake and resubmit."
        />
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setRejecting(false)}>
            Cancel
          </Button>
          <Button variant="secondary" className="border-danger text-danger" onClick={handleReject} loading={reject.isPending}>
            Confirm Rejection
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 rounded-lg bg-surface p-4 shadow-card">
      <Button variant="accent" size="lg" className="flex-1" onClick={handleApprove} loading={approve.isPending}>
        Approve
      </Button>
      <Button
        variant="secondary"
        size="lg"
        className="flex-1 border-danger text-danger"
        onClick={() => setRejecting(true)}
        disabled={approve.isPending}
      >
        Reject
      </Button>
    </div>
  );
}
