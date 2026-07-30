"use client";

import Link from "next/link";

export interface AuthorLinkProps {
  // null covers both "no author id available" (a system notification)
  // and any future case where there's simply nothing to link to.
  authorId: string | null;
  isAnonymous?: boolean;
  className?: string;
  children: React.ReactNode;
}

// The one place that decides "is this author tappable" -- wraps an
// avatar/name pair in a real link to /profile/{authorId}, or renders a
// plain, non-interactive span when there's nothing to link to (no
// author id) or the post is anonymous (Buzz posts only -- replies are
// never anonymous, see the migration's own note). Reused across post
// cards, reply cards, the reply sheet, and the notification panel so
// this decision is made in exactly one place.
export function AuthorLink({ authorId, isAnonymous, className, children }: AuthorLinkProps) {
  if (isAnonymous || !authorId) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link href={`/profile/${authorId}`} onClick={(e) => e.stopPropagation()} className={className}>
      {children}
    </Link>
  );
}
