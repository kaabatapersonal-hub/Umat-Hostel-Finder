import { splitOutPhoneNumbers, buildTelLink } from "@/lib/contact";
import { cn } from "@/lib/utils";

// Renders free text with any embedded Ghana phone number turned into a
// tappable tel: link -- the "call 023..." pattern Buzz posts and
// marketplace listing descriptions both benefit from. Deliberately scoped
// to phone numbers only, not arbitrary URLs -- linkifying user-supplied
// URL text would mean building and trusting a live href out of free text,
// a much larger surface than reusing the already-safe-by-construction
// tel: builder.
export function LinkifiedContent({ content, className }: { content: string; className?: string }) {
  const segments = splitOutPhoneNumbers(content);

  return (
    <p className={cn("whitespace-pre-line text-body text-ink-900", className)}>
      {segments.map((segment, i) =>
        segment.isPhoneNumber ? (
          <a
            key={i}
            href={buildTelLink(segment.text)}
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-brand-800 underline underline-offset-2"
          >
            {segment.text}
          </a>
        ) : (
          <span key={i}>{segment.text}</span>
        )
      )}
    </p>
  );
}
