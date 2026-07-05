"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { BuzzPostCard } from "./buzz-post-card";
import { ReplyCard } from "./reply-card";
import { useAuth } from "@/providers/auth-provider";
import { useBuzzPost } from "@/hooks/use-buzz-post";
import { useBuzzReplies } from "@/hooks/use-buzz-replies";
import { useCreateBuzzReply } from "@/hooks/use-create-buzz-reply";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";

const REPLY_MIN_LENGTH = 2;
const REPLY_MAX_LENGTH = 300;

export function PostDetailView({ postId }: { postId: string }) {
  const router = useRouter();
  const { requireAuth } = useAuth();
  const keyboardInset = useKeyboardInset();
  const [replyText, setReplyText] = useState("");

  const { data: post, isPending, isError, refetch } = useBuzzPost(postId);
  const repliesQuery = useBuzzReplies(postId);
  const createReply = useCreateBuzzReply();

  const replies = useMemo(() => repliesQuery.data?.pages.flatMap((page) => page.replies) ?? [], [repliesQuery.data]);

  function handleSend() {
    const trimmed = replyText.trim();
    if (trimmed.length < REPLY_MIN_LENGTH) return;
    requireAuth(() => {
      createReply.mutate({ postId, content: trimmed }, { onSuccess: () => setReplyText("") });
    });
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-5 pb-32">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-body-sm font-medium text-brand-800"
      >
        <ArrowLeft className="size-4" />
        Back
      </button>

      {isPending ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : isError || !post ? (
        <EmptyState
          icon={<AlertCircle className="size-7" strokeWidth={1.75} />}
          title="Couldn't load this post"
          description="It may have been removed, or check your connection."
          actionLabel="Retry"
          onAction={() => refetch()}
          className="bg-surface shadow-card"
        />
      ) : (
        <>
          <BuzzPostCard post={post} linkToDetail={false} />

          <h2 className="font-display text-h1 text-ink-900">Replies</h2>

          {repliesQuery.isPending ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-16 w-full rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
            </div>
          ) : replies.length === 0 ? (
            <p className="text-body-sm text-ink-300">No replies yet — start the conversation.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {replies.map((reply) => (
                <ReplyCard key={reply.id} reply={reply} />
              ))}
            </div>
          )}

          {repliesQuery.hasNextPage && (
            <Button
              variant="secondary"
              onClick={() => repliesQuery.fetchNextPage()}
              loading={repliesQuery.isFetchingNextPage}
            >
              Show more replies
            </Button>
          )}
        </>
      )}

      {post && (
        <div
          className="fixed inset-x-0 z-40 flex items-center gap-2 border-t border-line bg-surface px-4 py-3"
          style={{ bottom: keyboardInset || "calc(5rem + env(safe-area-inset-bottom))" }}
        >
          <input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value.slice(0, REPLY_MAX_LENGTH))}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder="Write a reply..."
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
      )}
    </div>
  );
}
