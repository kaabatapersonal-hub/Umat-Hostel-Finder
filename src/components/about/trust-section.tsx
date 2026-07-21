import { ScrollReveal } from "./scroll-reveal";

export function TrustSection() {
  return (
    <section className="bg-surface px-4 py-14 sm:px-6 sm:py-20">
      <ScrollReveal className="mx-auto flex max-w-2xl flex-col gap-5 text-center">
        <h2 className="font-display text-h1 text-ink-900 sm:text-display">Built by a UMaT student, for UMaT students</h2>
        <p className="text-body text-ink-500">
          Campa started because finding a hostel in Tarkwa meant walking around asking
          around, guessing distances, and hoping a manager picked up the phone. It uses UMaT&apos;s own
          green and gold, the campus&apos;s own room terms (&ldquo;1 in a room&rdquo;, &ldquo;2 in a room&rdquo;), and real
          walking distances to campus — the kind of detail that only comes from actually being a
          student here.
        </p>
        <p className="text-body text-ink-500">
          Reviews are signed in, one per student per hostel, and moderated — not anonymous, not
          stackable, and removable if they&apos;re reported and found to be unfair. It&apos;s a small
          platform built carefully, not a startup pitching scale it doesn&apos;t have yet.
        </p>
      </ScrollReveal>
    </section>
  );
}
