"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Eye, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkifiedContent } from "@/components/ui/linkified-content";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { PostActionsMenu, type PostActionItem } from "./post-actions-menu";
import { LikeButton, BUZZ_LIKE_JOIN_MESSAGE } from "./like-button";
import { ShareButton } from "./share-button";
import { ReplySheet } from "./reply-sheet";
import { ReportBuzzSheet } from "./report-buzz-sheet";
import { useAuth } from "@/providers/auth-provider";
import { useDeleteBuzzPost } from "@/hooks/use-delete-buzz-post";
import { useSetBuzzPostPinned } from "@/hooks/use-set-buzz-post-pinned";
import { useToggleBuzzLike } from "@/hooks/use-toggle-buzz-like";
import { useTrackBuzzPostView } from "@/hooks/use-track-buzz-post-view";
import { useSaveBuzzPostImage } from "@/hooks/use-save-buzz-post-image";
import { triggerHaptic } from "@/lib/haptics";
import { playSound } from "@/lib/sounds";
import { getInitials, formatRelativeTime, formatCompactCount, cn } from "@/lib/utils";
import { hasAdminPermission } from "@/lib/admin-permissions";
import type { BuzzPost } from "@/lib/queries/buzz";

const BUZZ_REPORT_JOIN_MESSAGE = "Join Campa to report a post";
const DOUBLE_TAP_THRESHOLD_MS = 300;
const FIRE_BURST_DURATION_MS = 700;

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && !!target.closest("button, a, input, textarea");
}

export interface BuzzPostCardProps {
  post: BuzzPost;
  index?: number;
  // Same reasoning as HostelCard -- only client-appended pages get the
  // entrance fade, first-paint content must render visible immediately.
  animateIn?: boolean;
  // Resolved by the caller (one batched get_verified_profiles call for
  // every post on screen) rather than fetched per-card -- see
  // use-verified-profiles.ts.
  isAuthorVerified?: boolean;
  authorVerificationLabel?: string | null;
  // Same batching principle as verification -- one useMyLikedPosts/
  // useMyBuzzReports call per screen, not per-card.
  isLiked?: boolean;
  isReported?: boolean;
}

// Buzz is a continuous, feed-only surface now -- there's no post detail
// page to link to (see the deleted post-detail-view.tsx and the
// src/app/buzz/[id] redirect). Every interaction happens right here: a
// single tap or a double-tap likes, the reply icon opens a bottom sheet,
// save downloads a branded image, share opens the system share sheet.
export function BuzzPostCard({
  post,
  index = 0,
  animateIn = true,
  isAuthorVerified = false,
  authorVerificationLabel = null,
  isLiked = false,
  isReported = false,
}: BuzzPostCardProps) {
  const { user, profile, requireAuth } = useAuth();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const deletePost = useDeleteBuzzPost();
  const setPinned = useSetBuzzPostPinned();
  const toggleLike = useToggleBuzzLike(post.id);
  const { saveAsImage, isSaving } = useSaveBuzzPostImage();

  // Tagged with this id prefix by useCreateBuzzPost's onMutate -- same
  // placeholder-id convention useToggleSave already uses. Nothing about
  // this post exists server-side yet: no likes/replies/moderation/
  // reporting/saving possible until the real row lands.
  const isOptimistic = post.id.startsWith("optimistic-");

  const viewRef = useTrackBuzzPostView(post.id, post.authorId, { enabled: !isOptimistic });

  // Short-lived local override for the optimistic feel, same pattern as
  // before -- cleared once the mutation settles and useToggleBuzzLike's
  // own invalidation has brought the server's true state back in.
  const [localLikeOverride, setLocalLikeOverride] = useState<boolean | null>(null);
  // Bumped on every fresh *like* (never an unlike) -- both the button's
  // pulse and the big fire-burst overlay key off this same trigger,
  // whether it came from tapping the button or double-tapping the card.
  const [likePulseKey, setLikePulseKey] = useState(0);
  const [showFireBurst, setShowFireBurst] = useState(false);
  const lastTapRef = useRef(0);

  const liked = localLikeOverride ?? isLiked;
  const displayLikeCount =
    post.likeCount + (localLikeOverride === null || localLikeOverride === isLiked ? 0 : localLikeOverride ? 1 : -1);

  useEffect(() => {
    if (!showFireBurst) return;
    const timer = setTimeout(() => setShowFireBurst(false), FIRE_BURST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [showFireBurst]);

  function handleLikeToggle() {
    if (isOptimistic) return;
    requireAuth(
      () => {
        const next = !liked;
        setLocalLikeOverride(next);
        toggleLike.mutate(next, { onSettled: () => setLocalLikeOverride(null) });
        // Sound, haptic, pulse, and the big fire burst all only ever fire
        // on the *liking* direction -- unliking is just undoing, not a
        // moment worth celebrating.
        if (next) {
          triggerHaptic();
          playSound("like");
          setLikePulseKey((k) => k + 1);
          setShowFireBurst(true);
        }
      },
      { message: BUZZ_LIKE_JOIN_MESSAGE }
    );
  }

  function handleCardTouchEnd(e: React.TouchEvent) {
    if (isOptimistic || isInteractiveTarget(e.target)) return;
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_THRESHOLD_MS) {
      lastTapRef.current = 0;
      handleLikeToggle();
    } else {
      lastTapRef.current = now;
    }
  }

  // Desktop fallback -- no touch events to time, so the native dblclick
  // event does the same job.
  function handleCardDoubleClick(e: React.MouseEvent) {
    if (isOptimistic || isInteractiveTarget(e.target)) return;
    handleLikeToggle();
  }

  // moderate_buzz, not a blanket role === 'admin' check -- a sub-admin
  // without this permission gets no Pin/Delete-others'-post actions here,
  // matching what the retrofitted buzz_posts RLS policies now enforce
  // server-side too (see Session 22 Part 2 in SECURITY.md).
  const canModerateBuzz = hasAdminPermission(profile, "moderate_buzz");
  const isOwn = !!user && user.id === post.authorId;
  const canModerate = !isOptimistic && (isOwn || canModerateBuzz);

  const actions: PostActionItem[] = [];
  if (canModerate) {
    if (canModerateBuzz) {
      actions.push({
        label: post.isPinned ? "Unpin" : "Pin",
        onClick: () => setPinned.mutate({ postId: post.id, pinned: !post.isPinned }),
      });
    }
    actions.push({ label: "Delete", destructive: true, onClick: () => setConfirmingDelete(true) });
  }
  // Reporting your own post makes no sense -- excluded regardless of
  // sign-in state, not just for the currently-signed-in user, since a
  // signed-out visitor doesn't have an authorId to compare against anyway
  // and requireAuth below is what actually gates the action.
  if (!isOptimistic && !isOwn) {
    actions.push({
      label: isReported ? "Reported" : "Report",
      disabled: isReported,
      onClick: () => requireAuth(() => setReportOpen(true), { message: BUZZ_REPORT_JOIN_MESSAGE }),
    });
  }

  return (
    <motion.div
      ref={viewRef}
      initial={animateIn ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index, 10) * 0.04, ease: [0.22, 1, 0.36, 1] }}
      onTouchEnd={handleCardTouchEnd}
      onDoubleClick={handleCardDoubleClick}
      className={cn(
        "relative flex flex-col gap-2.5 rounded-lg bg-surface p-4 shadow-card",
        post.isAdminPost && "border-l-4 border-brand-800",
        isOptimistic && "opacity-60"
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 font-display text-body-strong text-brand-800">
          {getInitials(post.authorName, null)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="line-clamp-1 text-body-strong text-ink-900">{post.authorName || "Student"}</span>
            {isAuthorVerified && <VerifiedBadge label={authorVerificationLabel} />}
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

        {!isOptimistic && !confirmingDelete && <PostActionsMenu actions={actions} />}
      </div>

      <LinkifiedContent content={post.content} />

      <div className="flex items-center justify-between pt-1">
        {isOptimistic ? (
          <span className="text-caption text-ink-500">Posting…</span>
        ) : confirmingDelete ? (
          <span className="flex items-center gap-2">
            <button type="button" className="text-caption text-ink-500" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="text-caption font-medium text-danger"
              onClick={() => deletePost.mutate(post.id)}
            >
              {deletePost.isPending ? "Deleting..." : "Delete"}
            </button>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-caption text-ink-500">
            <span className="flex items-center gap-1 px-1 text-[#94A3B8]">
              <Eye className="size-3.5" strokeWidth={1.75} />
              {formatCompactCount(post.viewCount)}
            </span>
            <LikeButton liked={liked} displayCount={displayLikeCount} pulseKey={likePulseKey} onTap={handleLikeToggle} />
            <button
              type="button"
              aria-label="Reply to this post"
              onClick={() => setRepliesOpen(true)}
              className="flex items-center gap-1 rounded-pill px-2 py-1 text-caption font-medium text-ink-500"
            >
              <MessageCircle className="size-3.5" strokeWidth={1.75} />
              {post.replyCount}
            </button>
            <button
              type="button"
              aria-label="Save post as image"
              disabled={isSaving}
              onClick={() => saveAsImage(post, { isAuthorVerified })}
              className="flex items-center gap-1 rounded-pill px-2 py-1 text-caption font-medium text-[#94A3B8] disabled:opacity-50"
            >
              <Download className="size-4" strokeWidth={1.75} />
            </button>
            <ShareButton postId={post.id} content={post.content} />
          </span>
        )}
      </div>

      <AnimatePresence>
        {showFireBurst && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1.5, transition: { type: "spring", stiffness: 260, damping: 14 } }}
            exit={{ opacity: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            aria-hidden
          >
            <span style={{ fontSize: 96, lineHeight: 1 }}>🔥</span>
          </motion.div>
        )}
      </AnimatePresence>

      {!isOptimistic && (
        <>
          <ReplySheet
            post={post}
            open={repliesOpen}
            onClose={() => setRepliesOpen(false)}
            isAuthorVerified={isAuthorVerified}
            authorVerificationLabel={authorVerificationLabel}
          />
          <ReportBuzzSheet open={reportOpen} onClose={() => setReportOpen(false)} postId={post.id} />
        </>
      )}
    </motion.div>
  );
}
