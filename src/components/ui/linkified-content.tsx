import { splitOutPhoneNumbers, buildTelLink } from "@/lib/contact";
import { cn } from "@/lib/utils";

// Renders free text with any embedded Ghana phone number turned into a
// tappable tel: link -- the "call 023..." pattern Buzz posts and
// marketplace listing descriptions both benefit from. Deliberately scoped
// to phone numbers only, not arbitrary URLs -- linkifying user-supplied
// URL text would mean building and trusting a live href out of free text,
// a much larger surface than reusing the already-safe-by-construction
// tel: builder.
export function LinkifiedContent({
  content,
  className,
  // False only where this content is already nested inside another <a>
  // (a feed card that Links its whole body to the post's own detail
  // page) -- a real <a> here would be invalid, nested-anchor HTML, which
  // React's hydration mismatch check actually catches at runtime (found
  // via a live console error, not by inspection): browsers silently
  // restructure/close the outer anchor when they hit a nested one, which
  // can quietly break that whole card's tap-to-open-detail behavior.
  // Phone numbers stay visually styled as a link either way; only the
  // real tel: target is withheld here, and only in that one context --
  // the number does become tappable a tap later, once the full post
  // (with no outer anchor around it) is open.
  linkify = true,
}: {
  content: string;
  className?: string;
  linkify?: boolean;
}) {
  const segments = splitOutPhoneNumbers(content);

  return (
    <p className={cn("whitespace-pre-line text-body text-ink-900", className)}>
      {segments.map((segment, i) =>
        segment.isPhoneNumber ? (
          linkify ? (
            <a
              key={i}
              href={buildTelLink(segment.text)}
              onClick={(e) => e.stopPropagation()}
              className="font-medium text-brand-800 underline underline-offset-2"
            >
              {segment.text}
            </a>
          ) : (
            <span key={i} className="font-medium text-brand-800 underline underline-offset-2">
              {segment.text}
            </span>
          )
        ) : (
          <span key={i}>{segment.text}</span>
        )
      )}
    </p>
  );
}
