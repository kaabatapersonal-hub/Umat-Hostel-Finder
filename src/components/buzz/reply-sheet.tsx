"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlay, Send, Flame } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LinkifiedContent } from "@/components/ui/linkified-content";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { ReplyCard } from "./reply-card";
import { GifPickerSheet } from "./gif-picker-sheet";
import { useAuth } from "@/providers/auth-provider";
import { useBuzzReplies } from "@/hooks/use-buzz-replies";
import { useCreateBuzzReply } from "@/hooks/use-create-buzz-reply";
import { useVerifiedProfiles } from "@/hooks/use-verified-profiles";
import { useMyBuzzReports } from "@/hooks/use-my-buzz-reports";
import { getInitials, formatRelativeTime, cn } from "@/lib/utils";
import type { BuzzPost } from "@/lib/queries/buzz";
import type { GifResult } from "@/lib/queries/gifs";

const REPLY_MIN_LENGTH = 2;
const REPLY_MAX_LENGTH = 300;
const BUZZ_REPLY_JOIN_MESSAGE = "Join Campa to reply — share hostel tips, find roommates, ask questions";

export interface ReplySheetProps {
  post: BuzzPost | null;
  open: boolean;
  onClose: () => void;
  isAuthorVerified?: boolean;
  authorVerificationLabel?: string | null;
}

// Replaces the old /buzz/[id] detail page's reply flow -- Buzz is
// feed-only now (see buzz-post-card.tsx), so replying happens in this
// bottom sheet instead of a full page navigation. Fetches its own
// replies/verified-authors/report-status on open rather than threading
// them down from the feed page, which never loads per-reply data anyway.
export function ReplySheet({ post, open, onClose, isAuthorVerified = false, authorVerificationLabel = null }: ReplySheetProps) {
  const { requireAuth } = useAuth();
  const [replyText, setReplyText] = useState("");
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const postId = post?.id ?? "";
  const repliesQuery = useBuzzReplies(postId, { enabled: open && !!postId });
  const createReply = useCreateBuzzReply();

  const replies = useMemo(() => repliesQuery.data?.pages.flatMap((page) => page.replies) ?? [], [repliesQuery.data]);
  const replyAuthorIds = useMemo(() => replies.map((r) => r.authorId), [replies]);
  const { data: verifiedMap } = useVerifiedProfiles(replyAuthorIds);
  const { data: myReports } = useMyBuzzReports();

  // Auto-focus the reply input on open so the keyboard comes straight up
  // on mobile -- a short delay lets the sheet's own slide-in animation
  // start first, matching the same posture as every other sheet-with-an-
  // input in this app.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) setReplyText("");
  }, [open]);

  function handleSend() {
    const trimmed = replyText.trim();
    if (trimmed.length < REPLY_MIN_LENGTH || !postId) return;
    requireAuth(
      () => {
        createReply.mutate({ postId, content: trimmed }, { onSuccess: () => setReplyText("") });
      },
      { message: BUZZ_REPLY_JOIN_MESSAGE }
    );
  }

  function handleSelectGif(gif: GifResult) {
    if (!postId) return;
    createReply.mutate({ postId, content: "", gifUrl: gif.fullUrl });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={post ? `Replies (${post.replyCount})` : "Replies"}
      className="flex max-h-[85vh] flex-col overflow-hidden"
    >
      {post && (
        <>
          <div className="mb-3 shrink-0 rounded-md bg-brand-50/40 p-3">
            <div className="flex items-start gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 font-display text-body-strong text-brand-800">
                {getInitials(post.authorName, null)}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="line-clamp-1 text-body-strong text-ink-900">{post.authorName || "Student"}</span>
                  {isAuthorVerified && <VerifiedBadge label={authorVerificationLabel} />}
                </div>
                <span className="text-caption text-ink-500">{formatRelativeTime(post.createdAt)}</span>
              </div>
            </div>
            <LinkifiedContent content={post.content} className="mt-2" />
            {/* A quiet like-count readout, not the full action row -- this
                is a compact reference card for what you're replying to,
                not another place to like/save/share from. */}
            <span className="mt-2 flex items-center gap-1 text-caption text-ink-500">
              <Flame className={cn("size-3.5", post.likeCount > 0 && "fill-gold-500 text-gold-500")} strokeWidth={1.75} />
              {post.likeCount}
            </span>
          </div>

          <div className="mb-3 border-t border-line" />
        </>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {repliesQuery.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        ) : replies.length === 0 ? (
          <p className="py-4 text-center text-body-sm text-ink-300">No replies yet — be the first.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {replies.map((reply) => (
              <ReplyCard
                key={reply.id}
                reply={reply}
                isAuthorVerified={verifiedMap?.has(reply.authorId) ?? false}
                authorVerificationLabel={verifiedMap?.get(reply.authorId) ?? null}
                isReported={myReports?.replyIds.has(reply.id) ?? false}
              />
            ))}
            {/* "Load more" surfaces further-along replies at the bottom, not
                the top -- replies are already oldest-first, so paging
                forward means newer replies, which belong after what's
                already loaded, not before it. */}
            {repliesQuery.hasNextPage && (
              <Button
                variant="secondary"
                onClick={() => repliesQuery.fetchNextPage()}
                loading={repliesQuery.isFetchingNextPage}
              >
                Show more replies
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex shrink-0 items-center gap-2 border-t border-line pt-3">
        <button
          type="button"
          aria-label="Send a GIF"
          onClick={() => requireAuth(() => setGifPickerOpen(true), { message: BUZZ_REPLY_JOIN_MESSAGE })}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-surface-muted"
        >
          <ImagePlay className="size-5" />
        </button>
        <input
          ref={inputRef}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value.slice(0, REPLY_MAX_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder={post?.authorName ? `Reply to ${post.authorName}...` : "Write a reply..."}
          aria-label="Write a reply"
          className="h-11 flex-1 rounded-full border border-line bg-surface-muted px-4 text-body text-ink-900 placeholder:text-ink-300 focus:outline-none"
        />
        <button
          type="button"
          aria-label="Send reply"
          onClick={handleSend}
          disabled={replyText.trim().length < REPLY_MIN_LENGTH || createReply.isPending}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gold-500 text-ink-900 disabled:opacity-50"
        >
          <Send className="size-5" />
        </button>
      </div>

      <GifPickerSheet open={gifPickerOpen} onClose={() => setGifPickerOpen(false)} onSelect={handleSelectGif} />
    </Sheet>
  );
}
