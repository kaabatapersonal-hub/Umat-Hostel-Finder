import Link from "next/link";

// A light, static header for the marketing surface -- distinct from the
// app's own fixed TopBar/BottomNav on purpose (this is a page you read,
// not a screen you navigate within), so it's built standalone rather than
// reusing app-shell chrome.
export function AboutHeader() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/about" className="font-display text-h2 text-brand-800">
          Campa
        </Link>
        <Link
          href="/"
          className="flex h-10 shrink-0 items-center justify-center rounded-md bg-brand-800 px-4 text-body-sm font-medium text-white"
        >
          Open app
        </Link>
      </div>
    </header>
  );
}
