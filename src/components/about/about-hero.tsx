import Link from "next/link";
import heroFeed from "@/assets/marketing/hero-feed.png";
import { PhoneFrame } from "./phone-frame";

export function AboutHero() {
  return (
    <section className="bg-gradient-to-br from-brand-800 to-brand-900 px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
      <div className="mx-auto grid max-w-5xl items-center gap-10 sm:grid-cols-2 sm:gap-8">
        <div className="flex flex-col items-start gap-5 text-center sm:text-left">
          <span className="label mx-auto text-caption text-gold-500 sm:mx-0">UMaT · Tarkwa</span>
          <h1 className="mx-auto font-display text-display-lg text-white sm:mx-0 sm:text-[2.5rem] sm:leading-tight">
            Every hostel near UMaT. One place.
          </h1>
          <p className="mx-auto max-w-md text-body text-white/80 sm:mx-0">
            Real photos, prices per room type, live availability, and direct WhatsApp contact with
            managers — no more walking around Tarkwa guessing where to live.
          </p>
          <div className="mx-auto flex flex-col gap-3 sm:mx-0 sm:flex-row">
            <Link
              href="/"
              className="flex h-12 items-center justify-center rounded-md bg-gold-500 px-6 text-body-strong font-semibold text-ink-900 hover:bg-gold-600"
            >
              Browse hostels
            </Link>
            <Link
              href="#managers"
              className="flex h-12 items-center justify-center rounded-md border border-white/30 px-6 text-body-strong font-medium text-white hover:bg-white/10"
            >
              List your hostel
            </Link>
          </div>
        </div>

        <PhoneFrame src={heroFeed} alt="The UMaT Hostel Finder home feed, showing hostels near campus with prices and availability" priority />
      </div>
    </section>
  );
}
