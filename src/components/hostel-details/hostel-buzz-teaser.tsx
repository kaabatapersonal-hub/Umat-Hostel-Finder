import Link from "next/link";
import { MessageSquare, ChevronRight } from "lucide-react";

// Session 21, engagement Hook 4: a light nudge toward Buzz from a hostel
// a student is already reading about -- Buzz has no per-hostel filtering
// yet (posts aren't tagged to a hostel), so this links to the tab itself
// rather than a filtered view, same fallback the brief's own wording
// allows ("or just the Buzz tab").
export function HostelBuzzTeaser() {
  return (
    <Link
      href="/buzz"
      className="flex items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3.5 shadow-card"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-800">
          <MessageSquare className="size-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-body-strong text-ink-900">Students are talking about hostels in Buzz</span>
          <span className="text-body-sm text-ink-500">See what they&apos;re saying</span>
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-ink-300" />
    </Link>
  );
}
