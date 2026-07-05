"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MessageCircle, Pin, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkifiedContent } from "./linkified-content";
import { useAuth } from "@/providers/auth-provider";
import { useDeleteBuzzPost } from "@/hooks/use-delete-buzz-post";
import { useSetBuzzPostPinned } from "@/hooks/use-set-buzz-post-pinned";
import { getInitials, formatRelativeTime, cn } from "@/lib/utils";
import type { BuzzPost } from "@/lib/queries/buzz";

export interface BuzzPostCardProps {
  post: BuzzPost;
  index?: number;
  // Same reasoning as HostelCard -- only client-appended pages get the
  // entrance fade, first-paint content must render visible immediately.
  animateIn?: boolean;
  // The detail page renders this same card in-place, not as a link to
  // itself.
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

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const cardBody = (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-lg bg-surface p-4 shadow-card",
        post.isAdminPost && "border-l-4 border-brand-800"
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 font-display text-body-strong text-brand-800">
          {getInitials(post.authorName, null)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="line-clamp-1 text-body-strong text-ink-900">{post.authorName || "Student"}</span>
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

      <LinkifiedContent content={post.content} />

      <div className="flex items-center justify-between pt-1">
        <span className="flex items-center gap-1 text-caption text-ink-500">
          <MessageCircle className="size-3.5" />
          {post.replyCount} {post.replyCount === 1 ? "reply" : "replies"}
        </span>

        {canModerate &&
          (confirmingDelete ? (
            <span className="flex items-center gap-2">
              <button type="button" className="text-caption text-ink-500" onClick={(e) => { stop(e); setConfirmingDelete(false); }}>
                Cancel
              </button>
              <button
                type="button"
                className="text-caption font-medium text-danger"
                onClick={(e) => {
                  stop(e);
                  deletePost.mutate(post.id);
                }}
              >
                {deletePost.isPending ? "Deleting..." : "Delete"}
              </button>
            </span>
          ) : (
            <span className="flex items-center gap-1">
              {isAdmin && (
                <button
                  type="button"
                  aria-label={post.isPinned ? "Unpin post" : "Pin post"}
                  onClick={(e) => {
                    stop(e);
                    setPinned.mutate({ postId: post.id, pinned: !post.isPinned });
                  }}
                  className="flex size-7 items-center justify-center rounded-full text-ink-500 hover:bg-surface-muted"
                >
                  <Pin className={cn("size-3.5", post.isPinned && "fill-gold-500 text-gold-500")} />
                </button>
              )}
              <button
                type="button"
                aria-label="Delete post"
                onClick={(e) => {
                  stop(e);
                  setConfirmingDelete(true);
                }}
                className="flex size-7 items-center justify-center rounded-full text-ink-500 hover:bg-surface-muted"
              >
                <Trash2 className="size-3.5" />
              </button>
            </span>
          ))}
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
