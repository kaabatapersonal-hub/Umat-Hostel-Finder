"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Phone, X } from "lucide-react";
import {
  buildWhatsAppLink,
  buildTelLink,
  buildHostelInquiryMessage,
  formatDisplayPhoneNumber,
} from "@/lib/contact";

export interface ContactBarProps {
  hostelName: string;
  whatsappNumber: string;
  callNumber: string | null;
}

// TODO(Session 6): replace with real auth state (e.g. a useSession() hook).
// When false, tapping either button should show the sign-in prompt below
// instead of revealing the numbers. The reveal interaction itself is fully
// built — Session 6 only needs to flip this condition on.
const IS_SIGNED_IN = true;

export function ContactBar({ hostelName, whatsappNumber, callNumber }: ContactBarProps) {
  const [revealed, setRevealed] = useState(false);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);

  function withAuthGate(action: () => void) {
    if (!IS_SIGNED_IN) {
      setShowSignInPrompt(true);
      return;
    }
    // The gate reveals both numbers at once, regardless of which button
    // was tapped.
    setRevealed(true);
    action();
  }

  function handleWhatsAppTap() {
    withAuthGate(() => {
      window.open(
        buildWhatsAppLink(whatsappNumber, buildHostelInquiryMessage(hostelName)),
        "_blank",
        "noopener,noreferrer"
      );
    });
  }

  function handleCallTap() {
    if (!callNumber) return;
    withAuthGate(() => {
      window.location.href = buildTelLink(callNumber);
    });
  }

  return (
    <>
      <div className="fixed inset-x-4 bottom-24 z-40 flex flex-col gap-2">
        <AnimatePresence>
          {revealed && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-0.5 self-end rounded-md bg-surface px-3 py-2 text-body-sm text-ink-900 shadow-md"
            >
              <span>WhatsApp: {formatDisplayPhoneNumber(whatsappNumber)}</span>
              {callNumber && <span>Call: {formatDisplayPhoneNumber(callNumber)}</span>}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            aria-label="Contact hostel manager on WhatsApp"
            onClick={handleWhatsAppTap}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-pill bg-[#25D366] px-5 text-white shadow-md"
          >
            <MessageCircle className="size-5" />
            <span className="text-body-strong font-semibold">
              {revealed ? "Open WhatsApp" : "WhatsApp"}
            </span>
          </motion.button>

          {callNumber && (
            <motion.button
              type="button"
              aria-label="Call hostel manager"
              onClick={handleCallTap}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="flex h-14 shrink-0 items-center justify-center gap-2 rounded-pill bg-brand-800 px-5 text-white shadow-md"
            >
              <Phone className="size-5" />
              <span className="text-body-strong font-semibold">Call</span>
            </motion.button>
          )}
        </div>
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
