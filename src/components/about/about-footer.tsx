import Link from "next/link";

const SIMOFORGE_URL = "https://simoforge-website.vercel.app";
const CONTACT_EMAIL = "kaabatapersonal@gmail.com";

export function AboutFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-brand-900 px-4 py-10 text-white sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="font-display text-h2 text-white">UMaT Hostel Finder</span>
          <p className="max-w-xs text-body-sm text-white/60">
            Find your next hostel near UMaT — real photos, real prices, direct contact with managers.
          </p>
        </div>

        <div className="flex flex-col gap-2 text-body-sm">
          <span className="label text-caption text-white/50">Quick links</span>
          <Link href="/" className="text-white/80 hover:text-white">
            Browse hostels
          </Link>
          <Link href="/about#managers" className="text-white/80 hover:text-white">
            List your hostel
          </Link>
          <a href="#faq" className="text-white/80 hover:text-white">
            FAQ
          </a>
        </div>

        <div className="flex flex-col gap-2 text-body-sm">
          <span className="label text-caption text-white/50">Contact</span>
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-white/80 hover:text-white">
            {CONTACT_EMAIL}
          </a>
        </div>
      </div>

      <div className="mx-auto mt-8 flex max-w-5xl flex-col gap-2 border-t border-white/10 pt-6 text-caption text-white/50 sm:flex-row sm:items-center sm:justify-between">
        <span>
          © {year} UMaT Hostel Finder. Not an official University of Mines and Technology service.
        </span>
        <span>
          Built by{" "}
          <a
            href={SIMOFORGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-white/80 hover:text-white"
          >
            SimoForge
          </a>
        </span>
      </div>
    </footer>
  );
}
