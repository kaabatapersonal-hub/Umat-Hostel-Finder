import Link from "next/link";
import { Upload, ShieldCheck, Settings2 } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

const STEPS = [
  {
    icon: Upload,
    title: "Submit your hostel",
    body: "Photos, room types, prices, and your WhatsApp number — takes a few minutes.",
  },
  {
    icon: ShieldCheck,
    title: "We verify and publish",
    body: "A quick quality check keeps the platform trustworthy for students — then you're live.",
  },
  {
    icon: Settings2,
    title: "You own your listing",
    body: "Update availability and details anytime. Changes are reviewed before they go live, so your listing is always accurate.",
  },
];

// Standalone by design -- this is the exact section Simon shares directly
// as /about#managers when pitching a hostel owner, so it can't assume the
// reader scrolled from the top.
export function ManagersSection() {
  return (
    <section id="managers" className="scroll-mt-6 bg-gradient-to-br from-brand-800 to-brand-900 px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-3xl text-center">
        <ScrollReveal>
          <span className="label text-caption text-gold-500">For hostel managers</span>
          <h2 className="mt-2 font-display text-h1 text-white sm:text-display">
            Own a hostel in Tarkwa? Get it in front of every UMaT student — free.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-body text-white/80">
            Students check Campa before they walk. A listing with real photos and
            per-room-type prices gets contacted directly on WhatsApp — no commission, no booking
            fee. Listing your hostel is free.
          </p>
        </ScrollReveal>

        <div className="mt-10 grid gap-6 text-left sm:grid-cols-3 sm:gap-6">
          {STEPS.map((step, i) => (
            <ScrollReveal key={step.title} delay={i * 0.08}>
              <div className="flex flex-col gap-2 rounded-lg bg-white/10 p-5">
                <step.icon className="size-6 text-gold-500" strokeWidth={1.75} />
                <h3 className="text-body-strong font-semibold text-white">
                  {i + 1}. {step.title}
                </h3>
                <p className="text-body-sm text-white/70">{step.body}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal>
          <p className="mt-8 text-body-sm text-white/70">
            Want top-of-feed visibility?{" "}
            <a href={`https://wa.me/${MANAGER_CONTACT_WHATSAPP}`} className="font-medium text-gold-500 underline underline-offset-2">
              Ask us about Featured placement
            </a>
            .
          </p>

          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/submit"
              className="flex h-12 w-full items-center justify-center rounded-md bg-gold-500 px-6 text-body-strong font-semibold text-ink-900 hover:bg-gold-600 sm:w-auto"
            >
              Submit your hostel
            </Link>
            <a
              href={`https://wa.me/${MANAGER_CONTACT_WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 w-full items-center justify-center rounded-md border border-white/30 px-6 text-body-strong font-medium text-white hover:bg-white/10 sm:w-auto"
            >
              Talk to us on WhatsApp
            </a>
          </div>
          <p className="mt-3 text-caption text-white/50">Prefer email? {MANAGER_CONTACT_EMAIL}</p>
        </ScrollReveal>
      </div>
    </section>
  );
}

const MANAGER_CONTACT_WHATSAPP = "233257653283";
const MANAGER_CONTACT_EMAIL = "kaabatapersonal@gmail.com";
