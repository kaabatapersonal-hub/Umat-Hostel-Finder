"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkifiedContent } from "@/components/ui/linkified-content";
import { PostActionsMenu } from "./post-actions-menu";
import { useAuth } from "@/providers/auth-provider";
import { useDeleteBuzzPost } from "@/hooks/use-delete-buzz-post";
import { useSetBuzzPostPinned } from "@/hooks/use-set-buzz-post-pinned";
import { getInitials, formatRelativeTime, cn } from "@/lib/utils";
import type { BuzzPost } from "@/lib/queries/buzz";

// Long enough that a genuinely 3-line post rarely trips this, short enough
// that an actual long post reliably does -- there's no line-count
// measurement available before paint, so this is a length-based proxy for
// "line-clamp-3 is probably cutting something off."
const FEED_TRUNCATION_HINT_LENGTH = 220;

export interface BuzzPostCardProps {
  post: BuzzPost;
  index?: number;
  // Same reasoning as HostelCard -- only client-appended pages get the
  // entrance fade, first-paint content must render visible immediately.
  animateIn?: boolean;
  // The detail page renders this same card in-place (full content, more
  // visual weight as "the parent"), not as a link to itself.
  linkToDetail?: boolean;
}

export function BuzzPostCard({ post, index = 0, animateIn = true, linkToDetail = true }: BuzzPostCardProps) {
  const { user, profile } = useAuth();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deletePost = useDeleteBuzzPost();
  const setPinned = useSetBuzzPostPinned();

  const isAdmin = profile?.role === "admin";
  const isOwn = !!user && user.id === post.authorId;
  const canModerate = isOwn || isAdmin;

  const actions = canModerate
    ? [
        ...(isAdmin ? [{ label: post.isPinned ? "Unpin" : "Pin", onClick: () => setPinned.mutate({ postId: post.id, pinned: !post.isPinned }) }] : []),
        { label: "Delete", destructive: true, onClick: () => setConfirmingDelete(true) },
      ]
    : [];

  const cardBody = (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-lg p-4",
        linkToDetail ? "bg-surface shadow-card active:scale-[0.99] transition-transform" : "bg-brand-50/40 shadow-card",
        post.isAdminPost && "border-l-4 border-brand-800"
      )}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-brand-50 font-display text-brand-800",
            linkToDetail ? "size-9 text-body-strong" : "size-11 text-h1"
          )}
        >
          {getInitials(post.authorName, null)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("line-clamp-1 text-ink-900", linkToDetail ? "text-body-strong" : "font-display text-h1")}>
              {post.authorName || "Student"}
            </span>
            {post.isAdminPost && (
              <Badge variant="available" size="sm">
                Official
              </Badge>
            )}
            {post.isPinned && (
              <Badge variant="filling" size="sm">
                Pinned
              </Badge>
            )}
          </div>
          <span className="text-caption text-ink-500">{formatRelativeTime(post.createdAt)}</span>
        </div>
      </div>

      <LinkifiedContent content={post.content} className={linkToDetail ? "line-clamp-3" : undefined} />
      {linkToDetail && post.content.length > FEED_TRUNCATION_HINT_LENGTH && (
        <span className="-mt-1.5 text-caption font-medium text-brand-800">Show more</span>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="flex items-center gap-1 text-caption text-ink-500">
          <MessageCircle className="size-3.5" />
          {post.replyCount} {post.replyCount === 1 ? "reply" : "replies"}
        </span>

        {confirmingDelete ? (
          <span className="flex items-center gap-2">
            <button
              type="button"
              className="text-caption text-ink-500"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setConfirmingDelete(false);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="text-caption font-medium text-danger"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                deletePost.mutate(post.id);
              }}
            >
              {deletePost.isPending ? "Deleting..." : "Delete"}
            </button>
          </span>
        ) : (
          <PostActionsMenu actions={actions} />
        )}
      </div>
    </div>
  );

  return (
    <motion.div
      initial={animateIn ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index, 10) * 0.04, ease: [0.22, 1, 0.36, 1] }}
    >
      {linkToDetail ? (
        <Link href={`/buzz/${post.id}`} className="block">
          {cardBody}
        </Link>
      ) : (
        cardBody
      )}
    </motion.div>
  );
}
