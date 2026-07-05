"use client";

import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { isSafeHttpUrl } from "@/lib/contact";

export interface WhatsappGroupBannerProps {
  whatsappGroupUrl: string;
}

export function WhatsappGroupBanner({ whatsappGroupUrl }: WhatsappGroupBannerProps) {
  // Defense in depth (Session 15): never render a non-https URL as a
  // clickable link, regardless of how it ended up stored -- see the
  // isSafeHttpUrl doc comment in lib/contact.ts.
  if (!isSafeHttpUrl(whatsappGroupUrl)) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-brand-50 px-4 py-3.5">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-800 text-white">
          <Users className="size-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-body-strong text-ink-900">Tenant community</span>
          <span className="text-body-sm text-ink-500">Join current tenants on WhatsApp</span>
        </div>
      </div>
      <motion.a
        href={whatsappGroupUrl}
        target="_blank"
        rel="noopener noreferrer"
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="inline-flex h-11 shrink-0 items-center justify-center rounded-md border border-brand-800 bg-surface px-3.5 text-body-sm font-medium text-brand-800"
      >
        Join Group
      </motion.a>
    </div>
  );
}
