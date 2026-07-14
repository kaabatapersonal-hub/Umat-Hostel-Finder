"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Heart, LogOut, Pencil, ShieldCheck, Trash2, UserCircle2, Building2, ShoppingBag, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton, SkeletonLine, SkeletonRow } from "@/components/ui/skeleton";
import { SavedHostelRow } from "@/components/hostels/saved-hostel-row";
import { useAuth } from "@/providers/auth-provider";
import { useSavedHostels } from "@/hooks/use-saved-hostels";
import { useMySubmissions } from "@/hooks/use-my-submissions";
import { useDeleteSubmission } from "@/hooks/use-delete-submission";
import { useMyOwnedHostels } from "@/hooks/use-my-owned-hostels";
import { useMyMarketListings } from "@/hooks/use-my-market-listings";
import { useSetMarketListingStatus } from "@/hooks/use-set-market-listing-status";
import { useDeleteMarketListing } from "@/hooks/use-delete-market-listing";
import { getInitials, formatRelativeTime } from "@/lib/utils";
import type { SubmissionSummary } from "@/lib/queries/submissions";
import type { MarketListing } from "@/lib/queries/market";

const SUBMISSION_STATUS_CONFIG: Record<string, { label: string; variant: "filling" | "available" | "full" }> = {
  pending: { label: "Pending", variant: "filling" },
  approved: { label: "Approved", variant: "available" },
  rejected: { label: "Rejected", variant: "full" },
};

function SubmissionRow({ submission }: { submission: SubmissionSummary }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteSubmission = useDeleteSubmission();
  const status = SUBMISSION_STATUS_CONFIG[submission.status] ?? SUBMISSION_STATUS_CONFIG.pending;
  const isPending = submission.status === "pending";

  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="line-clamp-1 text-body-strong text-ink-900">{submission.name}</span>
          <span className="text-caption text-ink-500">{formatRelativeTime(submission.createdAt)}</span>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      {isPending && (
        <div className="flex items-center gap-2">
          {confirmingDelete ? (
            <>
              <span className="flex-1 text-body-sm text-ink-500">Withdraw this submission?</span>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => deleteSubmission.mutate(submission.id)}
                loading={deleteSubmission.isPending}
                className="border-danger text-danger"
              >
                Withdraw
              </Button>
            </>
          ) : (
            <>
              <Link href={`/submit?submissionId=${submission.id}`}>
                <Button variant="ghost" size="sm">
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)}>
                <Trash2 className="size-3.5" />
                Withdraw
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MarketListingRow({ listing }: { listing: MarketListing }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const setStatus = useSetMarketListingStatus();
  const deleteListing = useDeleteMarketListing();
  const isSold = listing.status === "sold";

  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="line-clamp-1 text-body-strong text-ink-900">{listing.title}</span>
          <span className="text-caption text-ink-500">{formatRelativeTime(listing.createdAt)}</span>
        </div>
        {isSold && <Badge variant="full">Sold</Badge>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {confirmingDelete ? (
          <>
            <span className="flex-1 text-body-sm text-ink-500">Delete this listing?</span>
            <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => deleteListing.mutate(listing.id)}
              loading={deleteListing.isPending}
              className="border-danger text-danger"
            >
              Delete
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStatus.mutate({ listingId: listing.id, status: isSold ? "active" : "sold" })}
              loading={setStatus.isPending}
            >
              <CheckCircle2 className="size-3.5" />
              {isSold ? "Relist" : "Mark sold"}
            </Button>
            <Link href={`/market/${listing.id}/edit`}>
              <Button variant="ghost" size="sm">
                <Pencil className="size-3.5" />
                Edit
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)}>
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, profile, loading, requireAuth, signOut } = useAuth();
  const router = useRouter();
  const { data: saved = [], isPending: savedPending } = useSavedHostels();
  const { data: submissions = [], isPending: submissionsPending } = useMySubmissions();
  const { data: ownedHostels = [], isPending: ownedPending } = useMyOwnedHostels();
  const { data: marketListings = [], isPending: marketListingsPending } = useMyMarketListings(user?.id);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 px-4 pt-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-14 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <SkeletonLine className="w-1/2" />
            <SkeletonLine className="w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col">
        <PageHeader title="Profile" subtitle="Sign in to manage your saves and submissions" />
        <EmptyState
          icon={<UserCircle2 className="size-7" strokeWidth={1.75} />}
          title="You're not signed in"
          description="Sign in to save hostels, submit your own listing, and get updates on availability."
          actionLabel="Sign In"
          onAction={() => requireAuth(() => {})}
          className="mx-4 mt-4 bg-surface shadow-card"
        />
        <Link href="/about" className="mx-4 mt-4 text-center text-body-sm text-ink-500 underline underline-offset-2">
          About UMaT Hostel Finder
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-6">
      <div className="flex items-center gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-800 font-display text-h1 text-white">
          {getInitials(profile?.fullName, profile?.email ?? user.email)}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="line-clamp-1 font-display text-h1 text-ink-900">
            {profile?.fullName || "Student"}
          </span>
          <span className="line-clamp-1 text-body-sm text-ink-500">{profile?.email ?? user.email}</span>
        </div>
      </div>

      {profile?.role === "admin" && (
        <Link
          href="/admin"
          className="flex items-center gap-3 rounded-md border border-line bg-surface p-3 text-body-strong text-ink-900"
        >
          <ShieldCheck className="size-5 text-brand-800" />
          Admin Panel
        </Link>
      )}

      <Link href="/submit" className="block">
        <Button variant="accent" size="lg" className="w-full">
          Submit Hostel
        </Button>
      </Link>

      {ownedHostels.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-h1 text-ink-900">My Listings</h2>
          {ownedPending ? (
            <SkeletonRow />
          ) : (
            <div className="flex flex-col gap-2">
              {ownedHostels.map((hostel) => (
                <div
                  key={hostel.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface p-3"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Building2 className="size-4 shrink-0 text-brand-800" />
                    <span className="line-clamp-1 text-body-strong text-ink-900">{hostel.name}</span>
                    {hostel.hasPendingEdit && (
                      <Badge variant="filling" size="sm">
                        Edit pending
                      </Badge>
                    )}
                  </div>
                  <Link href={`/submit?hostelId=${hostel.id}`} className="shrink-0">
                    <Button variant="ghost" size="sm">
                      <Pencil className="size-3.5" />
                      Edit listing
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h1 text-ink-900">My Submissions</h2>
        {submissionsPending ? (
          <div className="flex flex-col gap-2">
            <SkeletonRow />
          </div>
        ) : submissions.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-7" strokeWidth={1.75} />}
            title="No submissions yet"
            description="Once you submit a hostel, its review status shows up here."
            className="bg-surface shadow-card"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {submissions.map((submission) => (
              <SubmissionRow key={submission.id} submission={submission} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h1 text-ink-900">My Marketplace Listings</h2>
        {marketListingsPending ? (
          <SkeletonRow />
        ) : marketListings.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="size-7" strokeWidth={1.75} />}
            title="No listings yet"
            description="Sell something you no longer need — it takes under a minute."
            actionLabel="Sell something"
            onAction={() => router.push("/market/sell")}
            className="bg-surface shadow-card"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {marketListings.map((listing) => (
              <MarketListingRow key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h1 text-ink-900">Saved Hostels</h2>
        {savedPending ? (
          <SkeletonRow />
        ) : saved.length === 0 ? (
          <EmptyState
            icon={<Heart className="size-7" strokeWidth={1.75} />}
            title="No saved hostels yet"
            description="Tap the heart on any hostel to keep it here for later."
            className="bg-surface shadow-card"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {saved.map((hostel) => (
              <SavedHostelRow key={hostel.id} saved={hostel} />
            ))}
          </div>
        )}
      </section>

      <Button variant="secondary" size="lg" onClick={() => signOut()} className="mt-2">
        <LogOut className="size-4" />
        Sign Out
      </Button>

      <Link href="/about" className="text-center text-body-sm text-ink-500 underline underline-offset-2">
        About UMaT Hostel Finder
      </Link>
    </div>
  );
}
