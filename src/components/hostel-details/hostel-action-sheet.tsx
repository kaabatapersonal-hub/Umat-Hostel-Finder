"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, ChevronRight } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { useTeamWhatsApp } from "@/hooks/use-team-whatsapp";
import { buildWhatsAppLink } from "@/lib/contact";

// A positive, multi-option action instead of a single negative "Report"
// button -- students flagging wrong info, offering to help, or missing
// their own hostel are three different intents, not one. WhatsApp, not
// an in-app form/queue -- see the Session 22 brief's own reasoning
// (instant, no new moderation surface to build under a launch deadline).
export function HostelActionSheet({ hostelName }: { hostelName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data: teamWhatsApp } = useTeamWhatsApp();

  function openWhatsApp(message: string) {
    if (!teamWhatsApp) return;
    window.open(buildWhatsAppLink(teamWhatsApp, message), "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  const options = [
    {
      label: "Report wrong information",
      description: "Tell us what's inaccurate",
      onClick: () => openWhatsApp(`Hi, I found wrong information on ${hostelName} on Campa: `),
    },
    {
      label: "I live here — I can help",
      description: "Offer photos or details for this listing",
      onClick: () => openWhatsApp(`Hi, I live at ${hostelName} and can help with photos/details for the listing on Campa.`),
    },
    {
      label: "My hostel isn't listed",
      description: "Submit it in under a minute",
      onClick: () => {
        setOpen(false);
        router.push("/submit");
      },
    },
    {
      label: "Contact the Campa team",
      description: "Ask us anything",
      onClick: () => openWhatsApp("Hi, I have a question about Campa."),
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 self-start text-body-sm text-ink-500"
      >
        <Flag className="size-3.5" />
        Something wrong with this listing?
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="How can we help?">
        <div className="flex flex-col gap-1">
          {options.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={option.onClick}
              className="flex items-center justify-between gap-3 rounded-md p-3 text-left hover:bg-surface-muted"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-body-strong text-ink-900">{option.label}</span>
                <span className="text-body-sm text-ink-500">{option.description}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-ink-300" />
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
