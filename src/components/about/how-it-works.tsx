import { Search, Home as HomeIcon, MessageCircle } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

const STEPS = [
  {
    icon: Search,
    title: "Search & compare",
    body: "Filter by price, distance to campus, and availability. Every hostel shows real prices per room type — 1 in a room through 6 in a room, UMaT's own terms — so you're comparing like for like from the first tap.",
  },
  {
    icon: HomeIcon,
    title: "See it properly",
    body: "Real photos for every room type, honest availability with a \"last updated\" timestamp, student reviews, and the exact location on a map with walking distance to campus — everything you'd want to know before you show up.",
  },
  {
    icon: MessageCircle,
    title: "Contact the manager directly",
    body: "No middleman, no booking fee. One tap opens WhatsApp with the manager who actually runs the place, so you can ask your own questions and agree things yourself.",
  },
];

// Doubles as SEO copy for "student accommodation near UMaT" -- written as
// real sentences, not fragments, on purpose.
export function HowItWorks() {
  return (
    <section className="bg-surface-muted px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <ScrollReveal>
          <h2 className="text-center font-display text-h1 text-ink-900 sm:text-display">How it works for students</h2>
        </ScrollReveal>

        <div className="mt-10 grid gap-6 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((step, i) => (
            <ScrollReveal key={step.title} delay={i * 0.08}>
              <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
                <div className="flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-800">
                  <step.icon className="size-6" strokeWidth={1.75} />
                </div>
                <h3 className="font-display text-h2 text-ink-900">
                  {i + 1}. {step.title}
                </h3>
                <p className="text-body text-ink-500">{step.body}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
