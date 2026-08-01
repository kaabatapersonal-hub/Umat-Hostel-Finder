"use client";

import { useState } from "react";
import { CheckCircle2, Megaphone } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSendAdminBroadcast } from "@/hooks/use-send-admin-broadcast";

export default function AdminBroadcastPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sentCount, setSentCount] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const sendBroadcast = useSendAdminBroadcast();

  const canSend = title.trim().length > 0 && body.trim().length > 0;

  function handleSend() {
    setFormError(null);
    sendBroadcast.mutate(
      { title: title.trim(), body: body.trim(), link: link.trim() || null },
      {
        onSuccess: (count) => {
          setSentCount(count);
          setConfirming(false);
          setTitle("");
          setBody("");
          setLink("");
        },
        onError: () => {
          setFormError("Couldn't send the broadcast — try again.");
          setConfirming(false);
        },
      }
    );
  }

  if (sentCount !== null) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-800">
          <CheckCircle2 className="size-7" strokeWidth={1.75} />
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-h1 text-ink-900">Sent!</h2>
          <p className="text-body text-ink-500">
            Delivered to {sentCount} student{sentCount === 1 ? "" : "s"}.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setSentCount(null)}>
          Send another
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-h1 text-ink-900">Broadcast</h1>
        <p className="text-body-sm text-ink-500">
          Sends one notification to every active (non-suspended) user. Use this for platform-wide announcements —
          it reaches everyone at once, so double-check the wording before sending.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-lg bg-surface p-4 shadow-card">
        <Input label="Title" placeholder="e.g. Marketplace is live! 🎉" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
        <Textarea
          label="Message"
          placeholder="What do you want students to know?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={300}
        />
        <Input
          label="Link (optional)"
          placeholder="/market"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          helperText="Where tapping the notification should take them, e.g. /market"
        />

        {formError && <p className="text-body-sm text-danger">{formError}</p>}

        {confirming ? (
          <div className="flex flex-col gap-2 rounded-md bg-surface-muted p-3">
            <p className="text-body-sm text-ink-700">
              <Megaphone className="mr-1.5 inline size-4 text-brand-800" />
              This will notify every active user right now. Send it?
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setConfirming(false)} className="flex-1">
                Cancel
              </Button>
              <Button variant="accent" onClick={handleSend} loading={sendBroadcast.isPending} className="flex-1">
                Yes, send to everyone
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="accent" size="lg" disabled={!canSend} onClick={() => setConfirming(true)}>
            <Megaphone className="size-4" />
            Send Broadcast
          </Button>
        )}
      </div>
    </div>
  );
}
