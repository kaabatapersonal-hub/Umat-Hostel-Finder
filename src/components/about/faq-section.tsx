import { ChevronDown } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

const FAQS = [
  {
    question: "Is it free?",
    answer:
      "Yes. Browsing hostels, viewing details, saving a shortlist, contacting managers, and listing a hostel are all free. Featured placement — extra visibility at the top of the feed — is the one paid option, and it's opt-in.",
  },
  {
    question: "Do I need an account?",
    answer:
      "No account is needed to browse hostels, see prices and photos, or contact a manager on WhatsApp. You'll only need a free account to save hostels to a shortlist or leave a review.",
  },
  {
    question: "How do I list my hostel?",
    answer:
      "Tap \"Submit your hostel\" and add photos, your room types and prices, and a WhatsApp number. An admin reviews every submission before it goes live — usually quick, never instant, so the platform stays trustworthy.",
  },
  {
    question: "Can I update my listing after it's approved?",
    answer:
      "Yes — sign in and edit your listing anytime, including availability. Changes are reviewed before they go live, the same check every new listing gets, so students can trust what they see.",
  },
  {
    question: "How are reviews handled?",
    answer:
      "Reviews are signed in, one per student per hostel, and moderated. A review can be reported, and a moderator can remove it if it's unfair, fake, or breaks the rules.",
  },
  {
    question: "Does UMaT Hostel Finder charge hostel managers?",
    answer:
      "Listing your hostel is free. Featured placement at the top of the feed is a paid option for managers who want extra visibility — ask us for details.",
  },
  {
    question: "Is this an official University of Mines and Technology service?",
    answer:
      "No — UMaT Hostel Finder is an independent project, built by a UMaT student, not operated by the university or the SRC. That may change if a formal partnership happens, and this page will say so clearly if it does.",
  },
];

// Native <details>/<summary> -- fully crawlable text with zero JS
// required, and free keyboard/screen-reader support, unlike a hand-rolled
// accordion.
export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-6 bg-surface-muted px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <ScrollReveal>
          <h2 className="text-center font-display text-h1 text-ink-900 sm:text-display">
            Frequently asked questions
          </h2>
        </ScrollReveal>

        <ScrollReveal className="mt-8 flex flex-col gap-3">
          {FAQS.map((faq) => (
            <details key={faq.question} className="group rounded-lg bg-surface p-4 shadow-card open:pb-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-body-strong font-semibold text-ink-900">
                {faq.question}
                <ChevronDown className="size-4 shrink-0 text-ink-500 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2.5 text-body text-ink-500">{faq.answer}</p>
            </details>
          ))}
        </ScrollReveal>
      </div>
    </section>
  );
}
