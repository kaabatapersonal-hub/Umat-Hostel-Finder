"use client";

import { Heart, UserCircle2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonLine } from "@/components/ui/skeleton";
import { SavedHostelRow } from "@/components/hostels/saved-hostel-row";
import { useAuth } from "@/providers/auth-provider";
import { useSavedHostels } from "@/hooks/use-saved-hostels";

export default function SavedPage() {
  const { user, requireAuth } = useAuth();
  const { data: saved = [], isPending } = useSavedHostels();

  return (
    <div className="flex flex-col">
      <PageHeader title="Saved" subtitle="Hostels you're keeping an eye on" />

      {!user ? (
        <EmptyState
          icon={<UserCircle2 className="size-7" strokeWidth={1.75} />}
          title="Sign in to see your saves"
          description="Saved hostels are tied to your account so they follow you across devices."
          actionLabel="Sign In"
          onAction={() => requireAuth(() => {})}
          className="mx-4 mt-4 bg-surface shadow-card"
        />
      ) : isPending ? (
        <div className="flex flex-col gap-2 px-4">
          <SkeletonLine className="h-16 w-full rounded-md" />
          <SkeletonLine className="h-16 w-full rounded-md" />
        </div>
      ) : saved.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-7" strokeWidth={1.75} />}
          title="No saved hostels yet"
          description="Tap the heart on any hostel to keep it here for later."
          className="mx-4 mt-4 bg-surface shadow-card"
        />
      ) : (
        <div className="flex flex-col gap-2 px-4">
          {saved.map((hostel) => (
            <SavedHostelRow key={hostel.id} saved={hostel} />
          ))}
        </div>
      )}
    </div>
  );
}
