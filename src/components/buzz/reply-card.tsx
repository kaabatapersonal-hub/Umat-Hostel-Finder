"use client";

import { useState } from "react";
import Image from "next/image";
import { LinkifiedContent } from "@/components/ui/linkified-content";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { PostActionsMenu, type PostActionItem } from "./post-actions-menu";
import { ReportBuzzSheet } from "./report-buzz-sheet";
import { useAuth } from "@/providers/auth-provider";
import { useDeleteBuzzReply } from "@/hooks/use-delete-buzz-reply";
import { getInitials, formatRelativeTime, cn } from "@/lib/utils";
import { hasAdminPermission } from "@/lib/admin-permissions";
import type { BuzzReply } from "@/lib/queries/buzz";

const BUZZ_REPORT_JOIN_MESSAGE = "Join Campa to report a reply";

export interface ReplyCardProps {
  reply: BuzzReply;
  isAuthorVerified?: boolean;
  authorVerificationLabel?: string | null;
  isReported?: boolean;
}

export function ReplyCard({ reply, isAuthorVerified = false, authorVerificationLabel = null, isReported = false }: ReplyCardProps) {
  const { user, profile, requireAuth } = useAuth();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const deleteReply = useDeleteBuzzReply(reply.postId);

  // Tagged by useCreateBuzzReply's onMutate -- nothing to moderate/report
  // yet, same reasoning as BuzzPostCard's isOptimistic.
  const isOptimistic = reply.id.startsWith("optimistic-");
  const isOwn = !!user && user.id === reply.authorId;
  const canModerate = !isOptimistic && (isOwn || hasAdminPermission(profile, "moderate_buzz"));

  const actions: PostActionItem[] = [];
  if (canModerate) {
    actions.push({ label: "Delete", destructive: true, onClick: () => setConfirmingDelete(true) });
  }
  if (!isOptimistic && !isOwn) {
    actions.push({
      label: isReported ? "Reported" : "Report",
      disabled: isReported,
      onClick: () => requireAuth(() => setReportOpen(true), { message: BUZZ_REPORT_JOIN_MESSAGE }),
    });
  }

  return (
    <div className={cn("flex items-start gap-2.5 rounded-md bg-surface-muted p-3", isOptimistic && "opacity-60")}>
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 font-display text-caption font-semibold text-brand-800">
        {getInitials(reply.authorName, null)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-body-sm font-medium text-ink-900">{reply.authorName || "Student"}</span>
          {isAuthorVerified && <VerifiedBadge label={authorVerificationLabel} />}
          <span className="text-caption text-ink-300">{isOptimistic ? "Sending…" : formatRelativeTime(reply.createdAt)}</span>
        </div>
        {reply.gifUrl ? (
          <div className="relative mt-0.5 aspect-square w-40 max-w-full overflow-hidden rounded-md bg-surface">
            <Image src={reply.gifUrl} alt="GIF reply" fill unoptimized sizes="160px" className="object-cover" />
          </div>
        ) : (
          <LinkifiedContent content={reply.content} className="text-body-sm" />
        )}
        {confirmingDelete && (
          <span className="flex items-center gap-2 pt-0.5">
            <button type="button" className="text-caption text-ink-500" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </button>
            <button type="button" className="text-caption font-medium text-danger" onClick={() => deleteReply.mutate(reply.id)}>
              {deleteReply.isPending ? "Deleting..." : "Delete"}
            </button>
          </span>
        )}
      </div>
      {!confirmingDelete && <PostActionsMenu actions={actions} />}
      {!isOptimistic && (
        <ReportBuzzSheet open={reportOpen} onClose={() => setReportOpen(false)} replyId={reply.id} />
      )}
    </div>
  );
}
