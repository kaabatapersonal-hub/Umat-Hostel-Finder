import Image from "next/image";
import { Star, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import featureMap from "@/assets/marketing/feature-map.png";
import featureRooms from "@/assets/marketing/feature-rooms.png";
import featureAvailability from "@/assets/marketing/feature-availability.png";
import featureSaved from "@/assets/marketing/feature-saved.png";
import { ScrollReveal } from "./scroll-reveal";

const FEATURES = [
  {
    title: "Real locations, real distances",
    body: "Every pin is a real GPS coordinate, not a guess. See exactly how far a hostel is from campus — on foot — before you spend an afternoon walking around Tarkwa to check.",
    image: featureMap,
    alt: "The UMaT Hostel Finder map showing a hostel's real location and walking distance to campus",
  },
  {
    title: "Prices for every room type",
    body: "1 in a room, 2 in a room, up to 6 in a room — UMaT's own terms. See exactly what each option costs, not one vague headline price that hides the real range.",
    image: featureRooms,
    alt: "Room types and prices with photos on a hostel's details page",
  },
  {
    title: "Availability you can trust",
    body: "Every listing shows its current status and when it was last updated, so you're not calling five hostels just to find out they're already full.",
    image: featureAvailability,
    alt: "A hostel's availability status and last-updated timestamp",
  },
] as const;

export function FeatureShowcase() {
  return (
    <section className="px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <ScrollReveal>
          <h2 className="text-center font-display text-h1 text-ink-900 sm:text-display">
            Built around how Tarkwa actually works
          </h2>
        </ScrollReveal>

        <div className="mt-10 flex flex-col gap-16 sm:gap-24">
          {FEATURES.map((feature, i) => (
            <ScrollReveal key={feature.title}>
              <div
                className={cn(
                  "grid items-center gap-8 sm:grid-cols-2 sm:gap-12",
                  i % 2 === 1 && "sm:[&>*:first-child]:order-2"
                )}
              >
                <div className="overflow-hidden rounded-lg shadow-card">
                  <Image src={feature.image} alt={feature.alt} placeholder="blur" sizes="(min-width: 640px) 460px, 90vw" />
                </div>
                <div className="flex flex-col gap-2 text-center sm:text-left">
                  <h3 className="font-display text-h2 text-ink-900">{feature.title}</h3>
                  <p className="text-body text-ink-500">{feature.body}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}

          <ScrollReveal>
            <div className="grid items-center gap-8 sm:grid-cols-2 sm:gap-12">
              <div className="flex flex-col gap-2 text-center sm:text-left">
                <h3 className="font-display text-h2 text-ink-900">Reviews from real students</h3>
                <p className="text-body text-ink-500">
                  Signed-in students who saved or lived at a hostel can leave a rating and review — one per
                  student, moderated, never an anonymous pile-on.
                </p>
              </div>
              <div className="flex items-center justify-center rounded-lg bg-brand-50 py-16">
                <Star className="size-16 fill-gold-500 text-gold-500" strokeWidth={1.5} />
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="grid items-center gap-8 sm:grid-cols-2 sm:gap-12 sm:[&>*:first-child]:order-2">
              <div className="overflow-hidden rounded-lg shadow-card">
                <Image
                  src={featureSaved}
                  alt="A shortlist of saved hostels on the Saved tab"
                  placeholder="blur"
                  sizes="(min-width: 640px) 460px, 90vw"
                />
              </div>
              <div className="flex flex-col gap-2 text-center sm:text-left">
                <h3 className="font-display text-h2 text-ink-900">Save your shortlist</h3>
                <p className="text-body text-ink-500">
                  Keep track of the hostels you&apos;re considering and come back to them anytime, from any
                  device — no more screenshotting listings to compare later.
                </p>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal>
            <div className="grid items-center gap-8 rounded-lg border border-dashed border-line bg-surface-muted p-6 sm:grid-cols-2 sm:gap-12 sm:p-10">
              <div className="flex flex-col gap-2 text-center sm:text-left">
                <span className="label mx-auto w-fit rounded-pill bg-gold-50 px-3 py-1 text-caption text-gold-600 sm:mx-0">
                  Coming soon
                </span>
                <h3 className="font-display text-h2 text-ink-900">Roommate Matcher</h3>
                <p className="text-body text-ink-500">
                  Finding a hostel is half the problem — finding someone compatible to share a room with is
                  the other half. We&apos;re building a matcher for that. Not live yet.
                </p>
              </div>
              <div className="flex items-center justify-center py-8 sm:py-16">
                <Users2 className="size-16 text-ink-300" strokeWidth={1.5} />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
