"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateBuzzPost } from "@/hooks/use-create-buzz-post";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 500;
const MIN_LENGTH = 5;

export function ComposeBuzzSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [content, setContent] = useState("");
  const createPost = useCreateBuzzPost();

  function handleClose() {
    setContent("");
    createPost.reset();
    onClose();
  }

  function handleSubmit() {
    const trimmed = content.trim();
    if (trimmed.length < MIN_LENGTH) return;
    createPost.mutate(trimmed, { onSuccess: handleClose });
  }

  const tooShort = content.trim().length > 0 && content.trim().length < MIN_LENGTH;

  return (
    <Sheet open={open} onClose={handleClose} title="New post">
      <div className="flex flex-col gap-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, MAX_LENGTH))}
          placeholder="What's the buzz? Availability, roommate search, a question about hostels near UMaT..."
          rows={5}
          autoFocus
          error={
            createPost.isError
              ? "Couldn't post -- try again."
              : tooShort
                ? `At least ${MIN_LENGTH} characters.`
                : undefined
          }
        />
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
