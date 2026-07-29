"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useReportBuzzItem } from "@/hooks/use-report-buzz-item";
import type { BuzzReportReason } from "@/lib/queries/buzz";

const REASONS: { value: BuzzReportReason; label: string }[] = [
  { value: "inappropriate", label: "Inappropriate" },
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "other", label: "Other" },
];

export interface ReportBuzzSheetProps {
  open: boolean;
  onClose: () => void;
  postId?: string | null;
  replyId?: string | null;
}

// One sheet handles both posts and replies -- the caller passes exactly
// one of postId/replyId, matching buzz_reports' own exactly-one-target
// CHECK constraint.
export function ReportBuzzSheet({ open, onClose, postId, replyId }: ReportBuzzSheetProps) {
  const [reason, setReason] = useState<BuzzReportReason>("inappropriate");
  const [details, setDetails] = useState("");
  const report = useReportBuzzItem();

  function handleClose() {
    setReason("inappropriate");
    setDetails("");
    report.reset();
    onClose();
  }

  function handleSubmit() {
    report.mutate(
      { postId, replyId, reason, details: reason === "other" ? details : null },
      { onSuccess: handleClose }
    );
  }

  return (
    <Sheet open={open} onClose={handleClose} title={replyId ? "Report this reply" : "Report this post"}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          {REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setReason(r.value)}
              className={cn(
                "rounded-md border px-3 py-2.5 text-body-sm font-medium transition-colors",
                reason === r.value ? "border-brand-800 bg-brand-800 text-white" : "border-line bg-surface text-ink-500"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {reason === "other" && (
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, 500))}
            placeholder="Tell us more (optional)"
            rows={3}
          />
        )}

        <Button variant="primary" size="lg" onClick={handleSubmit} loading={report.isPending}>
          Submit report
        </Button>
      </div>
    </Sheet>
  );
}
