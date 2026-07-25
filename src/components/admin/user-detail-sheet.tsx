"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Star, Bookmark, FileClock, Building2, ShieldCheck, ShieldOff, Ban, ShieldAlert, BadgeCheck } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { StarRating } from "@/components/reviews/star-rating";
import { getInitials, formatRelativeTime } from "@/lib/utils";
import { useAdminUserDetail } from "@/hooks/use-admin-user-detail";
import { useAuth } from "@/providers/auth-provider";
import { useSetUserRole } from "@/hooks/use-set-user-role";
import { useSetUserSuspended } from "@/hooks/use-set-user-suspended";
import { useSetUserVerified } from "@/hooks/use-set-user-verified";
import { useDeleteUserReviews } from "@/hooks/use-delete-user-reviews";
import { useDeleteUserReview } from "@/hooks/use-delete-user-review";
import { PERMISSION_OPTIONS } from "@/lib/admin-permissions";
import type { AdminPermission } from "@/lib/supabase/database.types";

type ConfirmAction = "promote" | "demote" | "suspend" | "unsuspend" | "delete-all-reviews" | "verify" | "unverify";

const CONFIRM_MESSAGES: Partial<Record<ConfirmAction, (name: string) => string>> = {
  demote: (name) => `Remove admin access from ${name}?`,
  suspend: (name) => `Suspend ${name}? They won't be able to post reviews or submissions until unsuspended.`,
  unsuspend: (name) => `Restore ${name}'s access?`,
  "delete-all-reviews": (name) => `Delete all of ${name}'s reviews? This can't be undone.`,
  unverify: (name) => `Remove ${name}'s verification badge?`,
};

export function UserDetailSheet({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { data: user, isPending, isError } = useAdminUserDetail(userId);
  const { user: currentAuthUser, profile: currentProfile } = useAuth();
  const [confirming, setConfirming] = useState<ConfirmAction | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<AdminPermission[]>([]);
  const [verifyLabel, setVerifyLabel] = useState("");
  const setRole = useSetUserRole();
  const setSuspended = useSetUserSuspended();
  const setVerified = useSetUserVerified();
  const deleteAllReviews = useDeleteUserReviews();
  const deleteReview = useDeleteUserReview(userId ?? "");

  const isSelf = !!currentAuthUser && currentAuthUser.id === userId;
  const isSuperAdmin = !!currentProfile?.isSuperAdmin;
  const actionPending = setRole.isPending || setSuspended.isPending || setVerified.isPending || deleteAllReviews.isPending;

  function closeAndReset() {
    setConfirming(null);
    setPermissionDraft([]);
    setVerifyLabel("");
    onClose();
  }

  function startPromote() {
    setPermissionDraft([]);
    setConfirming("promote");
  }

  function startVerify() {
    setVerifyLabel(user?.verificationLabel ?? "");
    setConfirming("verify");
  }

  function togglePermission(permission: AdminPermission) {
    setPermissionDraft((prev) => (prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission]));
  }

  function handleConfirm() {
    if (!user || !confirming) return;
    const onSuccess = () => setConfirming(null);
    switch (confirming) {
      case "promote":
        setRole.mutate({ userId: user.id, role: "admin", permissions: permissionDraft }, { onSuccess });
        break;
      case "demote":
        setRole.mutate({ userId: user.id, role: "student" }, { onSuccess });
        break;
      case "suspend":
        setSuspended.mutate({ userId: user.id, suspended: true }, { onSuccess });
        break;
      case "unsuspend":
        setSuspended.mutate({ userId: user.id, suspended: false }, { onSuccess });
        break;
      case "delete-all-reviews":
        deleteAllReviews.mutate(user.id, { onSuccess });
        break;
      case "verify":
        setVerified.mutate({ userId: user.id, verified: true, label: verifyLabel }, { onSuccess });
        break;
      case "unverify":
        setVerified.mutate({ userId: user.id, verified: false }, { onSuccess });
        break;
    }
  }

  return (
    <Sheet open={!!userId} onClose={closeAndReset} title={user?.fullName || "User"} className="sm:mx-auto sm:max-w-2xl">
      {isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : isError || !user ? (
        <EmptyState
          icon={<ShieldAlert className="size-7" strokeWidth={1.75} />}
          title="Couldn't load this user"
          description="Check your connection and try again."
        />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-800 font-display text-h1 text-white">
              {getInitials(user.fullName, user.email)}
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="line-clamp-1 text-body-strong text-ink-900">{user.fullName || "Unnamed"}</span>
                {user.isVerified && <VerifiedBadge label={user.verificationLabel} />}
              </div>
              <span className="line-clamp-1 text-body-sm text-ink-500">{user.email}</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={user.role === "admin" ? "available" : "neutral"} size="sm">
                  {user.role === "admin" ? "Admin" : "Student"}
                </Badge>
                {user.isSuspended && (
                  <Badge variant="full" size="sm">
                    Suspended
                  </Badge>
                )}
                <span className="text-caption text-ink-300">Joined {formatRelativeTime(user.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-y border-line py-3">
            {confirming === "promote" ? (
              <div className="flex w-full flex-col gap-3">
                <span className="text-caption text-ink-500">
                  Make {user.fullName || "this user"} an admin with these permissions:
                </span>
                <div className="flex flex-col gap-1.5">
                  {PERMISSION_OPTIONS.map((option) => (
                    <label key={option.value} className="flex items-start gap-2 text-body-sm text-ink-900">
                      <input
                        type="checkbox"
                        checked={permissionDraft.includes(option.value)}
                        onChange={() => togglePermission(option.value)}
                        className="mt-0.5 size-4 shrink-0 rounded-sm border-line accent-brand-800"
                      />
                      <span>
                        {option.label}
                        <span className="text-ink-500"> — {option.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                    Cancel
                  </Button>
                  <Button variant="accent" size="sm" onClick={handleConfirm} loading={actionPending}>
                    Make admin
                  </Button>
                </div>
              </div>
            ) : confirming === "verify" ? (
              <div className="flex w-full flex-col gap-3">
                <Input
                  label="Verification label (optional)"
                  placeholder="e.g. Campus Influencer, SRC Rep"
                  value={verifyLabel}
                  onChange={(e) => setVerifyLabel(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                    Cancel
                  </Button>
                  <Button variant="accent" size="sm" onClick={handleConfirm} loading={actionPending}>
                    Verify
                  </Button>
                </div>
              </div>
            ) : confirming ? (
              <div className="flex w-full flex-wrap items-center gap-2">
                <span className="flex-1 text-caption text-danger">{CONFIRM_MESSAGES[confirming]?.(user.fullName || "this user")}</span>
                <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="border-danger text-danger"
                  onClick={handleConfirm}
                  loading={actionPending}
                >
                  Confirm
                </Button>
              </div>
            ) : (
              <>
                {/* Promote/demote is super-admin-only -- a sub-admin with
                    manage_users can still suspend/verify, just not touch
                    admin status itself. Server-side, set_user_role enforces
                    this regardless of what this UI shows. */}
                {user.role === "admin" ? (
                  isSuperAdmin &&
                  !user.isSuperAdmin && (
                    <Button variant="secondary" size="sm" disabled={isSelf} onClick={() => setConfirming("demote")}>
                      <ShieldOff className="size-3.5" /> Demote to student
                    </Button>
                  )
                ) : (
                  isSuperAdmin && (
                    <Button variant="secondary" size="sm" onClick={startPromote}>
                      <ShieldCheck className="size-3.5" /> Promote to admin
                    </Button>
                  )
                )}
                {user.isVerified ? (
                  <Button variant="ghost" size="sm" onClick={() => setConfirming("unverify")}>
                    <BadgeCheck className="size-3.5" /> Remove verification
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" onClick={startVerify}>
                    <BadgeCheck className="size-3.5" /> Verify
                  </Button>
                )}
                {user.isSuspended ? (
                  <Button variant="secondary" size="sm" onClick={() => setConfirming("unsuspend")}>
                    Unsuspend
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" disabled={isSelf} className="text-danger" onClick={() => setConfirming("suspend")}>
                    <Ban className="size-3.5" /> Suspend
                  </Button>
                )}
                {user.reviews.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirming("delete-all-reviews")}>
                    Delete all reviews
                  </Button>
                )}
              </>
            )}
          </div>

          <Section title="Reviews" icon={Star} count={user.reviews.length}>
            {user.reviews.length === 0 ? (
              <p className="text-body-sm text-ink-300">No reviews written.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {user.reviews.map((review) => (
                  <div key={review.id} className="flex flex-col gap-1 rounded-md bg-surface-muted p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/hostel/${review.hostelId}#reviews`}
                        target="_blank"
                        className="text-body-sm font-medium text-ink-900 hover:underline"
                      >
                        {review.hostelName ?? "Unknown hostel"}
                      </Link>
                      <span className="text-caption text-ink-500">{formatRelativeTime(review.createdAt)}</span>
                    </div>
                    <StarRating rating={review.rating} />
                    <p className="line-clamp-2 text-caption text-ink-500">{review.comment}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="self-end text-danger"
                      onClick={() => deleteReview.mutate({ reviewId: review.id, hostelId: review.hostelId })}
                      loading={deleteReview.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Saved hostels" icon={Bookmark} count={user.savedHostels.length}>
            {user.savedHostels.length === 0 ? (
              <p className="text-body-sm text-ink-300">No saved hostels.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {user.savedHostels.map((s) => (
                  <li key={s.id}>
                    <Link href={`/hostel/${s.hostelId}`} target="_blank" className="text-body-sm text-brand-800 hover:underline">
                      {s.hostelName ?? "Unknown hostel"}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Submissions" icon={FileClock} count={user.submissions.length}>
            {user.submissions.length === 0 ? (
              <p className="text-body-sm text-ink-300">No submissions.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {user.submissions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-body-sm">
                    <span className="line-clamp-1 text-ink-900">{s.name}</span>
                    <Badge variant={s.status === "approved" ? "available" : s.status === "rejected" ? "full" : "filling"} size="sm">
                      {s.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Owns" icon={Building2} count={user.ownedHostels.length}>
            {user.ownedHostels.length === 0 ? (
              <p className="text-body-sm text-ink-300">Doesn&apos;t own any hostels.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {user.ownedHostels.map((h) => (
                  <li key={h.id}>
                    <Link href={`/hostel/${h.id}`} target="_blank" className="text-body-sm text-brand-800 hover:underline">
                      {h.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </Sheet>
  );
}

function Section({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: LucideIcon;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-body-sm font-medium text-ink-900">
        <Icon className="size-4 text-ink-500" />
        {title}
        <span className="text-ink-300">({count})</span>
      </div>
      {children}
    </div>
  );
}
