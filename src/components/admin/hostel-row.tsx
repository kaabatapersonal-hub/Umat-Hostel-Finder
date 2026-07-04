"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPinOff, Pencil, PenLine, Star, Trash2 } from "lucide-react";
import { SmartImage } from "@/components/ui/smart-image";
import { PriceTag } from "@/components/ui/price-tag";
import { Button } from "@/components/ui/button";
import { AvailabilitySelect } from "./availability-select";
import { FeaturedEditor } from "./featured-editor";
import { useDeleteHostelAdmin } from "@/hooks/use-delete-hostel-admin";
import { thumbnailSrc } from "@/lib/images";
import type { AdminHostelRow } from "@/lib/queries/admin-hostels";

export function HostelRow({ hostel }: { hostel: AdminHostelRow }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteHostel = useDeleteHostelAdmin();

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface p-3 shadow-card sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <SmartImage
          src={thumbnailSrc(hostel.thumbnail)}
          blurDataURL={hostel.thumbnail?.blurDataURL}
          alt={hostel.name}
          sizeHint="thumbnail"
          className="size-16 shrink-0 rounded-md"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="line-clamp-1 text-body-strong text-ink-900">{hostel.name}</span>
          <span className="line-clamp-1 text-caption text-ink-500">{hostel.location}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {hostel.priceMin != null && <PriceTag amount={hostel.priceMin} max={hostel.priceMax ?? undefined} className="text-caption" />}
            {hostel.ratingCount > 0 && (
              <span className="flex items-center gap-0.5 text-caption text-ink-500">
                <Star className="size-3 fill-gold-500 text-gold-500" />
                {hostel.ratingAvg.toFixed(1)}
              </span>
            )}
            {!hostel.hasCoordinates && (
              <span className="flex items-center gap-0.5 text-caption text-danger" title="No GPS coordinates">
                <MapPinOff className="size-3" />
                No coords
              </span>
            )}
            {hostel.hasPendingEdit && (
              <span className="flex items-center gap-0.5 text-caption text-gold-600">
                <PenLine className="size-3" />
                Edit pending
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
        <AvailabilitySelect hostelId={hostel.id} availability={hostel.availability} />
        <FeaturedEditor hostelId={hostel.id} featured={hostel.featured} featuredUntil={hostel.featuredUntil} isPaid={hostel.isPaid} />

        {confirmingDelete ? (
          <div className="flex items-center gap-1.5">
            <span className="text-caption text-danger">Delete permanently?</span>
            <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => deleteHostel.mutate(hostel.id)}
              loading={deleteHostel.isPending}
              className="border-danger text-danger"
            >
              Delete
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Link href={`/admin/hostels/${hostel.id}/edit`}>
              <Button variant="ghost" size="sm">
                <Pencil className="size-3.5" />
                Edit
              </Button>
            </Link>
            <Button variant="ghost" size="sm" aria-label={`Delete ${hostel.name}`} onClick={() => setConfirmingDelete(true)}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
