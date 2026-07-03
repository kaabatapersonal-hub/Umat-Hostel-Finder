"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSetHostelFeatured } from "@/hooks/use-set-hostel-featured";

export interface FeaturedEditorProps {
  hostelId: string;
  featured: boolean;
  featuredUntil: string | null;
  isPaid: boolean;
}

function daysUntil(dateStr: string, now: number): number {
  return Math.ceil((new Date(dateStr).getTime() - now) / 86_400_000);
}

// A tap-to-expand toggle+editor, so the hostels list can show featured
// status compactly (a badge) while still letting the admin set the expiry
// and paid flag inline, without a separate modal.
export function FeaturedEditor({ hostelId, featured, featuredUntil, isPaid }: FeaturedEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draftFeatured, setDraftFeatured] = useState(featured);
  const [draftUntil, setDraftUntil] = useState(featuredUntil ? featuredUntil.slice(0, 10) : "");
  const [draftPaid, setDraftPaid] = useState(isPaid);
  const setFeatured = useSetHostelFeatured();

  // Captured once via useState's lazy initializer (runs once at mount,
  // not on every render) rather than calling Date.now() inline in the
  // render body -- an admin glancing at this row doesn't need it to tick
  // over mid-glance, and this keeps rendering itself pure.
  const [now] = useState(() => Date.now());
  const isActive = featured && (!featuredUntil || new Date(featuredUntil).getTime() > now);
  const daysLeft = featuredUntil ? daysUntil(featuredUntil, now) : null;

  function openEditor() {
    setDraftFeatured(featured);
    setDraftUntil(featuredUntil ? featuredUntil.slice(0, 10) : "");
    setDraftPaid(isPaid);
    setEditing(true);
  }

  function handleSave() {
    setFeatured.mutate(
      {
        id: hostelId,
        update: {
          featured: draftFeatured,
          featuredUntil: draftFeatured && draftUntil ? new Date(`${draftUntil}T23:59:59`).toISOString() : null,
          isPaid: draftPaid,
        },
      },
      { onSuccess: () => setEditing(false) }
    );
  }

  if (!editing) {
    return (
      <button type="button" onClick={openEditor} className="flex items-center gap-1.5">
        {isActive ? (
          <Badge variant="featured" size="sm">
            Featured{daysLeft != null && (daysLeft <= 7 ? ` · ${daysLeft}d left` : "")}
          </Badge>
        ) : featured && daysLeft != null && daysLeft <= 0 ? (
          <Badge variant="neutral" size="sm">Featured expired</Badge>
        ) : (
          <Badge variant="neutral" size="sm">Not featured</Badge>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-surface-muted p-3">
      <label className="flex items-center gap-2 text-body-sm text-ink-900">
        <input
          type="checkbox"
          checked={draftFeatured}
          onChange={(e) => setDraftFeatured(e.target.checked)}
          className="size-4 rounded-sm border-line accent-brand-800"
        />
        Featured
      </label>

      {draftFeatured && (
        <>
          <Input
            label="Featured until (optional — never expires if blank)"
            type="date"
            value={draftUntil}
            onChange={(e) => setDraftUntil(e.target.value)}
          />
          <label className="flex items-center gap-2 text-body-sm text-ink-900">
            <input
              type="checkbox"
              checked={draftPaid}
              onChange={(e) => setDraftPaid(e.target.checked)}
              className="size-4 rounded-sm border-line accent-brand-800"
            />
            Paid placement
          </label>
        </>
      )}

      <div className="flex gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button variant="accent" size="sm" onClick={handleSave} loading={setFeatured.isPending}>
          Save
        </Button>
      </div>
    </div>
  );
}
