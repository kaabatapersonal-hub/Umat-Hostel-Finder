"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buildEditRequestDiff } from "@/lib/edit-request-diff";
import { useApplyEditRequest } from "@/hooks/use-apply-edit-request";
import { useDiscardEditRequest } from "@/hooks/use-discard-edit-request";
import type { EditRequestRow } from "@/lib/queries/admin-edit-requests";

export function EditRequestCard({ request }: { request: EditRequestRow }) {
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const apply = useApplyEditRequest();
  const discard = useDiscardEditRequest();
  const diff = buildEditRequestDiff(request.live, request.pending);

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/hostel/${request.id}`} target="_blank" className="text-body-strong text-ink-900 hover:underline">
          {request.live.name}
        </Link>
        <Link href={`/admin/hostels/${request.id}/edit`} className="text-caption font-medium text-brand-800">
          View full listing
        </Link>
      </div>

      {diff.length === 0 ? (
        <p className="text-body-sm text-ink-500">No detectable changes — the buffer may just be a re-save of the same values.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {diff.map((entry) => (
            <div key={entry.label} className="flex flex-col gap-0.5 rounded-md bg-surface-muted p-2.5 text-body-sm">
              <span className="font-medium text-ink-900">{entry.label}</span>
              <span className="text-danger line-through">{entry.oldValue}</span>
              <span className="text-success">{entry.newValue}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        {confirmingDiscard ? (
          <>
            <span className="flex-1 text-caption text-ink-500">Discard this request? The live listing won&apos;t change.</span>
            <Button variant="ghost" size="sm" onClick={() => setConfirmingDiscard(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="border-danger text-danger"
              onClick={() => discard.mutate(request.id)}
              loading={discard.isPending}
            >
              Confirm Discard
            </Button>
          </>
        ) : (
          <>
            <Button variant="accent" onClick={() => apply.mutate(request.id)} loading={apply.isPending}>
              Apply Changes
            </Button>
            <Button variant="ghost" onClick={() => setConfirmingDiscard(true)} disabled={apply.isPending}>
              Discard
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
