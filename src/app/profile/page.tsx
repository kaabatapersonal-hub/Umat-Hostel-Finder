"use client";

import Link from "next/link";
import { FileText, Heart, LogOut, ShieldCheck, UserCircle2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton, SkeletonLine } from "@/components/ui/skeleton";
import { SavedHostelRow } from "@/components/hostels/saved-hostel-row";
import { useAuth } from "@/providers/auth-provider";
import { useSavedHostels } from "@/hooks/use-saved-hostels";
import { useMySubmissions } from "@/hooks/use-my-submissions";
import { getInitials, formatRelativeTime } from "@/lib/utils";

const SUBMISSION_STATUS_CONFIG: Record<string, { label: string; variant: "filling" | "available" | "full" }> = {
  pending: { label: "Pending", variant: "filling" },
  approved: { label: "Approved", variant: "available" },
  rejected: { label: "Rejected", variant: "full" },
};

export default function ProfilePage() {
  const { user, profile, loading, requireAuth, signOut } = useAuth();
  const { data: saved = [], isPending: savedPending } = useSavedHostels();
  const { data: submissions = [], isPending: submissionsPending } = useMySubmissions();

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

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h1 text-ink-900">My Submissions</h2>
        {submissionsPending ? (
          <div className="flex flex-col gap-2">
            <SkeletonLine className="h-14 w-full rounded-md" />
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
            {submissions.map((submission) => {
              const status = SUBMISSION_STATUS_CONFIG[submission.status] ?? SUBMISSION_STATUS_CONFIG.pending;
              return (
                <div
                  key={submission.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface p-3"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="line-clamp-1 text-body-strong text-ink-900">{submission.name}</span>
                    <span className="text-caption text-ink-500">{formatRelativeTime(submission.createdAt)}</span>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h1 text-ink-900">Saved Hostels</h2>
        {savedPending ? (
          <SkeletonLine className="h-16 w-full rounded-md" />
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
    </div>
  );
}
