"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQueryClient, type InfiniteData, type UseMutationResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { createBuzzReply, type BuzzReply, type GetBuzzRepliesResult } from "@/lib/queries/buzz";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/components/ui/toast";

type BuzzRepliesCache = InfiniteData<GetBuzzRepliesResult>;
type CreateReplyInput = { postId: string; content: string; gifUrl?: string | null };

function appendToLastPage(
  cache: BuzzRepliesCache | undefined,
  updater: (replies: BuzzReply[]) => BuzzReply[]
): BuzzRepliesCache | undefined {
  if (!cache) return cache;
  const lastIndex = cache.pages.length - 1;
  return {
    ...cache,
    pages: cache.pages.map((page, i) => (i === lastIndex ? { ...page, replies: updater(page.replies) } : page)),
  };
}

// Same optimistic-then-reconcile shape as useCreateBuzzPost -- the reply
// appears at the end of the thread immediately (tagged with an
// `optimistic-` id), replaced by the real row on success, rolled back
// with a retryable toast on failure.
export function useCreateBuzzReply() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const mutationRef = useRef<UseMutationResult<BuzzReply, unknown, CreateReplyInput> | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ postId, content, gifUrl }: CreateReplyInput) => {
      const {
        data: { user: freshUser },
      } = await supabase.auth.getUser();
      if (!freshUser) throw new Error("Not signed in");
      return createBuzzReply(supabase, { postId, authorId: freshUser.id, content, gifUrl });
    },
    onMutate: async ({ postId, content, gifUrl }) => {
      const queryKey = ["buzz-replies", postId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<BuzzRepliesCache>(queryKey);
      const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const optimisticReply: BuzzReply = {
        id: tempId,
        postId,
        authorId: user?.id ?? "",
        authorName: profile?.fullName ?? null,
        content,
        gifUrl: gifUrl ?? null,
        createdAt: new Date().toISOString(),
      };

      queryClient.setQueryData<BuzzRepliesCache>(queryKey, (old) =>
        appendToLastPage(old, (replies) => [...replies, optimisticReply])
      );

      return { previous, tempId, postId };
    },
    onError: (_err, variables, context) => {
      if (context) queryClient.setQueryData(["buzz-replies", context.postId], context.previous);
      showToast({
        message: "Couldn't send your reply — try again?",
        variant: "error",
        actionLabel: "Retry",
        onAction: () => mutationRef.current?.mutate(variables),
      });
    },
    onSuccess: (reply, { postId }, context) => {
      queryClient.setQueryData<BuzzRepliesCache>(["buzz-replies", postId], (old) =>
        appendToLastPage(old, (replies) => replies.map((r) => (r.id === context?.tempId ? reply : r)))
      );
      // reply_count is trigger-maintained -- refetch the post to pick up
      // whatever it just recalculated (same reasoning as useSubmitReview
      // refetching a hostel's rating_avg/rating_count).
      queryClient.invalidateQueries({ queryKey: ["buzz-post", postId] });
      queryClient.invalidateQueries({ queryKey: ["buzz-feed"] });
      queryClient.invalidateQueries({ queryKey: ["buzz-pinned"] });
    },
    onSettled: (_reply, _err, { postId }) => {
      // Belt-and-suspenders reconciliation, same posture as
      // useToggleSave's onSettled -- the targeted cache patch above
      // handles the common case instantly, this just guarantees the
      // thread matches the server exactly regardless of edge cases
      // (e.g. a concurrent reply from someone else landing in between).
      queryClient.invalidateQueries({ queryKey: ["buzz-replies", postId] });
    },
  });

  // Not a render-phase ref write (disallowed) -- onError only ever fires
  // from a user-initiated mutate() call, which can't happen before this
  // effect has already run at least once, so the ref is always current
  // by the time it's actually read.
  useEffect(() => {
    mutationRef.current = mutation;
  });

  return mutation;
}
