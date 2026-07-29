"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useResolveBuzzReport } from "@/hooks/use-resolve-buzz-report";
import { formatRelativeTime } from "@/lib/utils";
import type { AdminBuzzReportRow } from "@/lib/queries/buzz";

const REASON_LABELS: Record<AdminBuzzReportRow["reason"], string> = {
  inappropriate: "Inappropriate",
  spam: "Spam",
  harassment: "Harassment",
  other: "Other",
};

export function BuzzReportCard({ report }: { report: AdminBuzzReportRow }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const resolve = useResolveBuzzReport();

  return (
    <div className="flex flex-col gap-2.5 rounded-lg bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Badge variant="neutral" size="sm">
            {report.targetType === "post" ? "Post" : "Reply"}
          </Badge>
          <span className="text-body-sm font-medium text-ink-900">{REASON_LABELS[report.reason]}</span>
        </div>
        <span className="text-caption text-ink-500">{formatRelativeTime(report.createdAt)}</span>
      </div>

      <p className="line-clamp-3 whitespace-pre-line text-body text-ink-500">{report.targetPreview}</p>

      {report.details && <p className="text-body-sm text-ink-500">&ldquo;{report.details}&rdquo;</p>}

      <span className="text-caption text-ink-300">Reported by {report.reporterName || "Student"}</span>

      <div className="flex items-center gap-2 pt-1">
        {confirmingDelete ? (
          <>
            <span className="flex-1 text-caption text-danger">Delete this {report.targetType} permanently?</span>
            <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="border-danger text-danger"
              onClick={() => resolve.mutate({ reportId: report.id, action: "delete" })}
              loading={resolve.isPending}
            >
              Delete
            </Button>
          </>
        ) : (
          <>
            {report.targetPostId && (
              <Link href={`/buzz/${report.targetPostId}`} target="_blank" className="text-body-sm font-medium text-brand-800 hover:underline">
                View post
              </Link>
            )}
            <div className="flex flex-1 justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => resolve.mutate({ reportId: report.id, action: "dismiss" })}
                loading={resolve.isPending}
              >
                Dismiss
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)} disabled={resolve.isPending}>
                Delete {report.targetType}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
