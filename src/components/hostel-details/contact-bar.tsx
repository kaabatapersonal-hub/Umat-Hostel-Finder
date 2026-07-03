"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Phone } from "lucide-react";
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

// Contact is the app's core job — it's open for everyone, signed in or not.
// No auth check, no reveal-behind-a-gate: tapping WhatsApp opens wa.me
// immediately; tapping Call opens tel: immediately. (Session 4 built a
// tap-to-reveal-behind-sign-in version of this; Session 6 dropped the gate
// on purpose rather than activating it — the number-as-text reveal below is
// kept purely as a convenience, not a gate.)
export function ContactBar({ hostelName, whatsappNumber, callNumber }: ContactBarProps) {
  const [revealed, setRevealed] = useState(false);

  function handleWhatsAppTap() {
    setRevealed(true);
    window.open(
      buildWhatsAppLink(whatsappNumber, buildHostelInquiryMessage(hostelName)),
      "_blank",
      "noopener,noreferrer"
    );
  }

  function handleCallTap() {
    if (!callNumber) return;
    setRevealed(true);
    window.location.href = buildTelLink(callNumber);
  }

  return (
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
          <span className="text-body-strong font-semibold">{revealed ? "Open WhatsApp" : "WhatsApp"}</span>
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
  );
}
