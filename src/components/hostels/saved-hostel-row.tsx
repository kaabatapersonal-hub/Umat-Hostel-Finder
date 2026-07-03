"use client";

import Link from "next/link";
import { SmartImage } from "@/components/ui/smart-image";
import { PriceTag } from "@/components/ui/price-tag";
import { Button } from "@/components/ui/button";
import { useToggleSave } from "@/hooks/use-toggle-save";
import type { SavedHostel } from "@/lib/queries/saved-hostels";

export function SavedHostelRow({ saved }: { saved: SavedHostel }) {
  const toggle = useToggleSave();

  function handleUnsave() {
    toggle.mutate({
      hostel: {
        id: saved.hostelId,
        name: saved.name ?? "",
        priceMin: saved.priceMin,
        priceMax: saved.priceMax,
        location: saved.location ?? "",
        imageUrl: saved.imageUrl,
        imageBlur: saved.imageBlur,
      },
      isSaved: true,
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-md border border-line bg-surface p-3">
      <Link href={`/hostel/${saved.hostelId}`} className="shrink-0">
        <SmartImage
          src={saved.imageUrl}
          blurDataURL={saved.imageBlur}
          alt={saved.name ?? "Hostel"}
          sizeHint="thumbnail"
          className="size-16 rounded-md"
        />
      </Link>

      <Link href={`/hostel/${saved.hostelId}`} className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="line-clamp-1 text-body-strong text-ink-900">{saved.name}</span>
        <span className="line-clamp-1 text-body-sm text-ink-500">{saved.location}</span>
        {saved.priceMin != null && (
          <PriceTag amount={saved.priceMin} max={saved.priceMax ?? undefined} className="w-fit" />
        )}
      </Link>

      <Button variant="ghost" size="sm" onClick={handleUnsave} loading={toggle.isPending} className="shrink-0">
        Unsave
      </Button>
    </div>
  );
}
