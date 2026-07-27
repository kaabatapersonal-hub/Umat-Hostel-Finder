import Link from "next/link";

// The same three links appear twice on Profile (signed-out and signed-in
// states) -- one shared component so they can't drift out of sync.
export function LegalLinksRow({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Link href="/about" className="text-body-sm text-ink-500 underline underline-offset-2">
        About Campa
      </Link>
      <span className="text-body-sm text-ink-300"> · </span>
      <Link href="/terms" className="text-body-sm text-ink-500 underline underline-offset-2">
        Terms of Service
      </Link>
      <span className="text-body-sm text-ink-300"> · </span>
      <Link href="/privacy" className="text-body-sm text-ink-500 underline underline-offset-2">
        Privacy Policy
      </Link>
    </div>
  );
}
