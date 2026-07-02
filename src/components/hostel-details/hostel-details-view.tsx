"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertCircle, Building2 } from "lucide-react";
import { useHostel } from "@/hooks/use-hostel";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import type { HostelDetails } from "@/lib/queries/hostels";
import { ImageGallery } from "./image-gallery";
import { HeaderBlock } from "./header-block";
import { AvailabilityBlock } from "./availability-block";
import { FacilitiesGrid } from "./facilities-grid";
import { RoomTypeBreakdown } from "./room-type-breakdown";
import { WhatsappGroupBanner } from "./whatsapp-group-banner";
import { ReviewsPlaceholder } from "./reviews-placeholder";
import { ContactBar } from "./contact-bar";
import { DetailsSkeleton } from "./details-skeleton";

export interface HostelDetailsViewProps {
  id: string;
  // undefined -> client fetches. null -> server already confirmed not-found.
  // HostelDetails -> server-rendered, shown immediately.
  initialHostel?: HostelDetails | null;
}

export function HostelDetailsView({ id, initialHostel }: HostelDetailsViewProps) {
  const {
    data: hostel,
    isPending,
    isError,
    refetch,
  } = useHostel(id, { initialData: initialHostel });

  // True only during the very first render. Content shown then is either
  // already part of the server-sent HTML (SSR initialHostel) or, if not,
  // appears after hydration has clearly already finished — either way a
  // mount fade-in would just leave already-painted content at opacity:0
  // until Framer Motion hydrates, which on a throttled connection can take
  // seconds (see the identical fix on the feed in Session 3).
  const isFirstPaintRef = useRef(true);
  useEffect(() => {
    isFirstPaintRef.current = false;
  }, []);

  if (isPending) {
    return <DetailsSkeleton />;
  }

  if (isError) {
    return (
      <div className="px-4 pt-6">
        <EmptyState
          icon={<AlertCircle className="size-7" strokeWidth={1.75} />}
          title="Couldn't load this hostel"
          description="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => refetch()}
          className="bg-surface shadow-card"
        />
      </div>
    );
  }

  if (!hostel) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-6">
        <EmptyState
          icon={<Building2 className="size-7" strokeWidth={1.75} />}
          title="Hostel not found"
          description="This listing may have been removed, or the link is broken."
          className="bg-surface shadow-card"
        />
        <Link href="/" className="self-center">
          <Button variant="primary">Back to Home</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-8">
      <ImageGallery images={hostel.images} alt={hostel.name} />

      <motion.div
        initial={isFirstPaintRef.current ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-6 px-4 py-5"
      >
        <HeaderBlock
          name={hostel.name}
          priceMin={hostel.priceMin}
          priceMax={hostel.priceMax}
          location={hostel.location}
          distanceText={hostel.distanceText}
          ratingAvg={hostel.ratingAvg}
          ratingCount={hostel.ratingCount}
        />

        <AvailabilityBlock
          availability={hostel.availability}
          availabilityUpdatedAt={hostel.availabilityUpdatedAt}
        />

        {hostel.description && (
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-h1 text-ink-900">About this hostel</h2>
            <p className="max-w-prose text-body leading-relaxed text-ink-500">{hostel.description}</p>
          </div>
        )}

        <FacilitiesGrid facilities={hostel.facilities} />

        <RoomTypeBreakdown roomTypes={hostel.roomTypes} />

        {hostel.whatsappGroup && <WhatsappGroupBanner whatsappGroupUrl={hostel.whatsappGroup} />}

        <ReviewsPlaceholder ratingAvg={hostel.ratingAvg} ratingCount={hostel.ratingCount} />
      </motion.div>

      <ContactBar hostelName={hostel.name} whatsappNumber={hostel.contact} callNumber={hostel.callNumber} />
    </div>
  );
}
