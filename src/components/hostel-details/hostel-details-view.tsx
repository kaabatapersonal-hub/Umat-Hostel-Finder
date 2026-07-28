"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertCircle, Building2 } from "lucide-react";
import { useHostel } from "@/hooks/use-hostel";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import { trackHostelView } from "@/lib/nudges";
import type { HostelDetails } from "@/lib/queries/hostels";
import { mergeGalleryImages } from "@/lib/room-types";
import { ImageGallery } from "./image-gallery";
import { HeaderBlock } from "./header-block";
import { AvailabilityBlock } from "./availability-block";
import { FacilitiesGrid } from "./facilities-grid";
import { RoomTypeBreakdown } from "./room-type-breakdown";
import { WhatsappGroupBanner } from "./whatsapp-group-banner";
import { ReviewsSection } from "@/components/reviews/reviews-section";
import { HostelBuzzTeaser } from "./hostel-buzz-teaser";
import { HostelMarketListingsSection } from "./hostel-market-listings-section";
import { HostelActionSheet } from "./hostel-action-sheet";
import { ContactBar } from "./contact-bar";
import { DetailsSkeleton } from "./details-skeleton";
import { RelatedHostelsSidebar } from "./related-hostels-sidebar";
import { RelatedHostelsSection } from "./related-hostels-section";

export interface HostelDetailsViewProps {
  id: string;
  // undefined -> client fetches. null -> server already confirmed not-found.
  // HostelDetails -> server-rendered, shown immediately.
  initialHostel?: HostelDetails | null;
}

export function HostelDetailsView({ id, initialHostel }: HostelDetailsViewProps) {
  const { user } = useAuth();
  const {
    data: hostel,
    isPending,
    isError,
    refetch,
  } = useHostel(id, { initialData: initialHostel });

  // Signed-out only -- powers the "browsed 3+ hostels" nudge banner on
  // the home feed (see lib/nudges.ts). A signed-in visitor never needs
  // the nudge, so there's nothing worth tracking for them.
  const hostelId = hostel?.id;
  useEffect(() => {
    if (!user && hostelId) trackHostelView(hostelId);
  }, [user, hostelId]);

  // True only during the very first render. Content shown then is either
  // already part of the server-sent HTML (SSR initialHostel) or, if not,
  // appears after hydration has clearly already finished — either way a
  // mount fade-in would just leave already-painted content at opacity:0
  // until Framer Motion hydrates, which on a throttled connection can take
  // seconds (see the identical fix on the feed in Session 3).
  //
  // A ref, not state: the alternative (setState in the mount effect) trades
  // this file's "no ref reads during render" lint finding for the *other*
  // new react-hooks rule, "no setState in an effect body" -- neither hook
  // shape satisfies both rules at once for a flag that must be correct on
  // the very first render yet must not force an extra render just to prove
  // it. Pre-existing finding (react-hooks/refs), not introduced this
  // session -- left as-is rather than trading it for an equivalent one.
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

  // The hero gallery shows every photo tied to the hostel, not just the
  // general gallery -- a hostel with photos only on its room types
  // shouldn't show the "no photos yet" placeholder while those sit unseen
  // further down the page.
  const galleryImages = mergeGalleryImages(hostel.images, hostel.roomTypes);

  return (
    <div className="flex flex-col pb-8 lg:pb-12">
      {/* The "watch page" split: main content stays exactly as it's always
          been, just capped to 2/3 width at desktop instead of stretching
          full-bleed (better line lengths too); the sidebar is a separate
          desktop-only surface, never appended below on mobile (that's
          RelatedHostelsSection's job instead, further down). */}
      <div className="lg:mx-auto lg:grid lg:max-w-7xl lg:grid-cols-3 lg:gap-8 lg:px-6 lg:pt-6">
        <div className="lg:col-span-2">
          <ImageGallery
            images={galleryImages}
            hostel={{
              id: hostel.id,
              name: hostel.name,
              priceMin: hostel.priceMin,
              priceMax: hostel.priceMax,
              location: hostel.location,
              imageUrl: galleryImages[0]?.url ?? null,
              imageBlur: galleryImages[0]?.blurDataURL ?? null,
            }}
            whatsappNumber={hostel.contact || null}
          />

          <motion.div
            initial={isFirstPaintRef.current ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-6 px-4 py-5 lg:px-0"
          >
            <HeaderBlock
              hostelId={hostel.id}
              name={hostel.name}
              priceMin={hostel.priceMin}
              priceMax={hostel.priceMax}
              location={hostel.location}
              distanceText={hostel.distanceText}
              distanceToCampusKm={hostel.distanceToCampusKm}
              latitude={hostel.latitude}
              longitude={hostel.longitude}
              ratingAvg={hostel.ratingAvg}
              ratingCount={hostel.ratingCount}
            />

            <AvailabilityBlock
              availability={hostel.availability}
              availabilityUpdatedAt={hostel.availabilityUpdatedAt}
            />

            {(hostel.description || hostel.roomTypes.length === 0) && (
              <div className="flex flex-col gap-2">
                <h2 className="font-display text-h1 text-ink-900">About this hostel</h2>
                {hostel.description && (
                  <p className="max-w-prose text-body leading-relaxed text-ink-500">{hostel.description}</p>
                )}
                {hostel.roomTypes.length === 0 && (
                  <p className="text-body-sm text-ink-500">Room details being added — contact manager for availability.</p>
                )}
              </div>
            )}

            <FacilitiesGrid facilities={hostel.facilities} />

            <RoomTypeBreakdown roomTypes={hostel.roomTypes} />

            {hostel.whatsappGroup && <WhatsappGroupBanner whatsappGroupUrl={hostel.whatsappGroup} />}

            <ReviewsSection
              hostelId={hostel.id}
              hostelOwnerId={hostel.ownerId}
              ratingAvg={hostel.ratingAvg}
              ratingCount={hostel.ratingCount}
            />

            <HostelBuzzTeaser />

            <HostelMarketListingsSection hostelId={hostel.id} hostelName={hostel.name} />

            <HostelActionSheet hostelName={hostel.name} />
          </motion.div>
        </div>

        <aside className="hidden lg:sticky lg:top-6 lg:block lg:self-start">
          <RelatedHostelsSidebar hostelId={hostel.id} location={hostel.location} priceMin={hostel.priceMin} />
        </aside>
      </div>

      <RelatedHostelsSection hostelId={hostel.id} location={hostel.location} priceMin={hostel.priceMin} />

      {hostel.contact ? (
        <ContactBar hostelName={hostel.name} whatsappNumber={hostel.contact} callNumber={hostel.callNumber} />
      ) : (
        // A broken WhatsApp button (empty number) is worse than no button
        // at all -- this should be unreachable in practice (contact is
        // required by the Submit form), but defensive against directly
        // seeded/imported rows that skipped it.
        <div className="fixed inset-x-0 z-40 flex justify-center" style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}>
          <div className="mx-4 rounded-pill bg-surface px-4 py-2.5 text-body-sm text-ink-500 shadow-md">
            Manager contact being confirmed — check back soon.
          </div>
        </div>
      )}
    </div>
  );
}
