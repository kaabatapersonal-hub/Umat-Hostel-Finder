import { UserCircle2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function ProfilePage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Profile" subtitle="Sign in to manage your listings and saves" />
      <EmptyState
        icon={<UserCircle2 className="size-7" strokeWidth={1.75} />}
        title="You're not signed in"
        description="Sign in to save hostels, submit your own listing, and get updates on availability."
        className="mx-4 mt-4 bg-surface shadow-card"
      />
      <div className="px-4 pt-2">
        <Button variant="accent" size="lg" className="w-full">
          Submit Hostel
        </Button>
      </div>
    </div>
  );
}
