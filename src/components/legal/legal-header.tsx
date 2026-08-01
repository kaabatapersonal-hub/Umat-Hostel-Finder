import Link from "next/link";

// Same light, standalone header shape as AboutHeader (no fixed TopBar/
// BottomNav here either -- this is a page you read start to finish, not
// a screen you navigate within) -- "Back to app" instead of "Open app"
// since these pages are reached from inside the app (footer, Profile),
// not a cold marketing landing.
export function LegalHeader() {
  return (
    <header className="border-b border-line bg-surface" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/about" className="font-display text-h2 text-brand-800">
          Campa
        </Link>
        <Link
          href="/"
          className="flex h-10 shrink-0 items-center justify-center rounded-md bg-brand-800 px-4 text-body-sm font-medium text-white"
        >
          Back to app
        </Link>
      </div>
    </header>
  );
}
