"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { useCreateBuzzPost } from "@/hooks/use-create-buzz-post";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 500;
const MIN_LENGTH = 5;

export function ComposeBuzzSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const createPost = useCreateBuzzPost();

  function handleClose() {
    setContent("");
    setIsAnonymous(false);
    createPost.reset();
    onClose();
  }

  function handleSubmit() {
    const trimmed = content.trim();
    if (trimmed.length < MIN_LENGTH) return;
    createPost.mutate({ content: trimmed, isAnonymous }, { onSuccess: handleClose });
  }

  return (
    <Sheet open={open} onClose={handleClose} title="New post">
      <div className="flex flex-col gap-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, MAX_LENGTH))}
          placeholder="What's the buzz? Availability, roommate search, a question about hostels near UMaT..."
          rows={5}
          autoFocus
          // The Post button is already disabled below the minimum length --
          // that's the feedback. No separate "too short" error message
          // needed on top of it.
          error={createPost.isError ? "Couldn't post -- try again." : undefined}
        />

        <div className="flex items-center justify-between gap-3 rounded-md bg-surface-muted p-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-body-sm font-medium text-ink-900">Post anonymously</span>
            <span className="text-caption text-ink-500">Shows as &quot;Student&quot; with no profile link</span>
          </div>
          <Toggle
            checked={isAnonymous}
            onChange={() => setIsAnonymous((v) => !v)}
            label={isAnonymous ? "Turn off anonymous posting" : "Turn on anonymous posting"}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className={cn("text-caption", content.length > MAX_LENGTH - 20 ? "text-gold-600" : "text-ink-300")}>
            {content.length}/{MAX_LENGTH}
          </span>
          <Button
            variant="accent"
            onClick={handleSubmit}
            loading={createPost.isPending}
            disabled={content.trim().length < MIN_LENGTH}
          >
            Post
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
