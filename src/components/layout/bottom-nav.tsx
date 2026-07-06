"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Home, Map, MessageSquare, Heart, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsKeyboardOpen } from "@/hooks/use-keyboard-inset";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/map", label: "Map", icon: Map },
  { href: "/buzz", label: "Buzz", icon: MessageSquare },
  { href: "/saved", label: "Saved", icon: Heart },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  // Same pattern as every chat app -- a focused text input pushes the
  // keyboard up over the layout viewport, and the nav has nowhere correct
  // to sit while that's happening (it either floats mid-screen or gets
  // shoved off the top). Sliding it fully out of the way while typing,
  // same as the reply bar docking against the keyboard instead, is the
  // standard mobile idiom.
  const isKeyboardOpen = useIsKeyboardOpen();

  return (
    <motion.nav
      animate={{ y: isKeyboardOpen ? "100%" : "0%" }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-brand-900/40 bg-brand-800 shadow-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                onClick={(e) => {
                  // Tapping the tab you're already on has nowhere to
                  // navigate to -- scroll back to the top instead, a free
                  // "get me back to the start" affordance.
                  if (isActive) {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: shouldReduceMotion ? "auto" : "smooth" });
                  }
                }}
                className="relative flex flex-col items-center justify-center gap-1 py-2.5 text-caption"
              >
                <motion.span
                  whileTap={{ scale: 0.92 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col items-center gap-1"
                >
                  <Icon
                    className={cn("size-6", isActive ? "text-gold-500" : "text-white/80")}
                    strokeWidth={isActive ? 2.25 : 1.75}
                  />
                  <span
                    className={cn(
                      "font-medium",
                      isActive ? "text-gold-500" : "text-white/80"
                    )}
                  >
                    {label}
                  </span>
                </motion.span>
              </Link>
            </li>
          );
        })}
      </ul>
    </motion.nav>
  );
}
