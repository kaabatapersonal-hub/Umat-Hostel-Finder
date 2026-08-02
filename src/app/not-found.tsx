import Link from "next/link";
import { Compass } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

// Renders inside the root layout like any other page, so it already gets
// the app's usual TopBar/BottomNav via ConditionalAppShell -- without a
// file here, Next falls back to its own hardcoded not-found markup (white
// text meant for a dark background), which is nearly invisible against
// this app's light theme.
export default function NotFound() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-6">
      <EmptyState
        icon={<Compass className="size-7" strokeWidth={1.75} />}
        title="Page not found"
        description="This link may be broken, or the page may have moved."
        className="bg-surface shadow-card"
      />
      <Link href="/" className="self-center">
        <Button variant="primary">Back to Home</Button>
      </Link>
    </div>
  );
}
