"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { buildWhatsAppLink, buildHostelInquiryMessage, normalizePhoneForWhatsApp } from "@/lib/whatsapp";

export interface ContactFabProps {
  hostelName: string;
  contact: string;
}

// TODO(Session 6): replace with real auth state (e.g. a useSession() hook).
// When false, tapping the FAB should show the sign-in prompt below instead
// of revealing the number. The reveal/WhatsApp-link interaction itself is
// fully built — Session 6 only needs to flip this condition on.
const IS_SIGNED_IN = true;

function formatDisplayNumber(raw: string): string {
  const normalized = normalizePhoneForWhatsApp(raw);
  if (normalized.length !== 12) return raw;
  return `+${normalized.slice(0, 3)} ${normalized.slice(3, 5)} ${normalized.slice(5, 8)} ${normalized.slice(8)}`;
}

export function ContactFab({ hostelName, contact }: ContactFabProps) {
  const [revealed, setRevealed] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);

  function handleTap() {
    if (!IS_SIGNED_IN) {
      setShowSignInPrompt(true);
      return;
    }
    setRevealed(true);
    window.open(
      buildWhatsAppLink(contact, buildHostelInquiryMessage(hostelName)),
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <>
      <div className="fixed right-4 bottom-24 z-40 flex flex-col items-end gap-2">
        <AnimatePresence>
          {revealed && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-md bg-surface px-3 py-2 text-body-sm text-ink-900 shadow-md"
            >
              {formatDisplayNumber(contact)}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          aria-label="Contact hostel manager on WhatsApp"
          onClick={handleTap}
          whileTap={{ scale: 0.94 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="flex h-14 items-center gap-2 rounded-pill bg-gold-500 px-5 text-ink-900 shadow-md"
        >
          <MessageCircle className="size-5" />
          <span className="text-body-strong font-semibold">
            {revealed ? "Open WhatsApp" : "Contact Manager"}
          </span>
        </motion.button>
      </div>

      <AnimatePresence>
        {showSignInPrompt && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-4 bottom-24 z-50 flex items-center justify-between gap-3 rounded-md bg-ink-900 px-4 py-3 text-body-sm text-white shadow-md"
          >
            <span>Sign in to contact the manager — coming in Session 6.</span>
            <button type="button" aria-label="Dismiss" onClick={() => setShowSignInPrompt(false)}>
              <X className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
