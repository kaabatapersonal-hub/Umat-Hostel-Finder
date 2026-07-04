"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

// The landing page is entirely static/server-rendered -- there's no
// "content added after first paint" the way the feed's pagination has, so
// EVERY section here counts as first-paint content per the Session 3
// hydration lesson. A naive whileInView animation would still render
// opacity:0 in the server HTML (Framer can't know the viewport at server
// render time), hiding real content from anyone who scrolls before JS
// hydrates on a slow connection.
//
// Fix: render a plain, fully-visible div until a post-mount effect
// confirms hydration is done, then swap to the animated motion.div. The
// swap is a real unmount/remount (different branch, not just changed
// props), so `initial` genuinely applies only from that point on --
// sections already on screen at that instant get a brief, bounded
// re-fade (acceptable), sections still below the fold get a proper
// reveal the first time they're scrolled into view (the actual point of
// this component).
export function ScrollReveal({ children, className, delay = 0 }: ScrollRevealProps) {
  const [hydrated, setHydrated] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Same documented react-hooks/set-state-in-effect finding as Session
  // 12's isFirstPaint pattern and Session 12.5's TopBar -- synchronizing
  // local state with "has hydration completed" has no effect-free
  // alternative that's also SSR-safe. Left as-is.
  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated || shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
