"use client";

import { useState } from "react";
import { LinkifiedContent } from "./linkified-content";
import { PostActionsMenu } from "./post-actions-menu";
import { useAuth } from "@/providers/auth-provider";
import { useDeleteBuzzReply } from "@/hooks/use-delete-buzz-reply";
import { getInitials, formatRelativeTime } from "@/lib/utils";
import type { BuzzReply } from "@/lib/queries/buzz";

export function ReplyCard({ reply }: { reply: BuzzReply }) {
  const { user, profile } = useAuth();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteReply = useDeleteBuzzReply(reply.postId);

  const isAdmin = profile?.role === "admin";
  const isOwn = !!user && user.id === reply.authorId;
  const canModerate = isOwn || isAdmin;

  const actions = canModerate ? [{ label: "Delete", destructive: true, onClick: () => setConfirmingDelete(true) }] : [];

  return (
    <div className="flex items-start gap-2.5 rounded-md bg-surface-muted p-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 font-display text-caption font-semibold text-brand-800">
        {getInitials(reply.authorName, null)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-body-sm font-medium text-ink-900">{reply.authorName || "Student"}</span>
          <span className="text-caption text-ink-300">{formatRelativeTime(reply.createdAt)}</span>
        </div>
        <LinkifiedContent content={reply.content} className="text-body-sm" />
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
    </div>
  );
}
