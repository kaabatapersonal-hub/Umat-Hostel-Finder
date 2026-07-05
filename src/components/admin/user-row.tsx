"use client";

import { Star, Bookmark, FileClock, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getInitials, formatRelativeTime } from "@/lib/utils";
import type { AdminUserRow } from "@/lib/queries/admin-users";

export function UserRow({ user, onSelect }: { user: AdminUserRow; onSelect: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(user.id)}
      className="flex items-center gap-3 rounded-lg bg-surface p-3 text-left shadow-card transition-colors hover:bg-surface-muted"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 font-display text-body-strong text-brand-800">
        {getInitials(user.fullName, user.email)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="line-clamp-1 text-body-strong text-ink-900">{user.fullName || "Unnamed"}</span>
          <Badge variant={user.role === "admin" ? "available" : "neutral"} size="sm">
            {user.role === "admin" ? "Admin" : "Student"}
          </Badge>
          {user.isSuspended && (
            <Badge variant="full" size="sm">
              Suspended
            </Badge>
          )}
        </div>
        <span className="line-clamp-1 text-caption text-ink-500">{user.email}</span>
        <div className="flex flex-wrap items-center gap-2.5 text-caption text-ink-500">
          <span className="flex items-center gap-1" title="Reviews written">
            <Star className="size-3" /> {user.reviewCount}
          </span>
          <span className="flex items-center gap-1" title="Hostels saved">
            <Bookmark className="size-3" /> {user.saveCount}
          </span>
          <span className="flex items-center gap-1" title="Submissions made">
            <FileClock className="size-3" /> {user.submissionCount}
          </span>
          <span className="flex items-center gap-1" title="Hostels owned">
            <Building2 className="size-3" /> {user.ownedHostelCount}
          </span>
          <span>Joined {formatRelativeTime(user.createdAt)}</span>
        </div>
      </div>
    </button>
  );
}
