"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertCircle, MessageCircle, Phone, MessageSquare, Pencil } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { BuzzPostCard } from "@/components/buzz/buzz-post-card";
import { usePublicProfile } from "@/hooks/use-public-profile";
import { useUserBuzzPosts } from "@/hooks/use-user-buzz-posts";
import { useMyLikedPosts } from "@/hooks/use-my-liked-posts";
import { useMyBuzzReports } from "@/hooks/use-my-buzz-reports";
import { useAuth } from "@/providers/auth-provider";
import { buildWhatsAppLink, buildTelLink, formatDisplayPhoneNumber } from "@/lib/contact";

// Public, no sign-in required -- get_public_profile and buzz_posts are
// both anon-readable already, same posture as the marketplace seller
// page this mirrors (src/components/market/seller-sale-view.tsx).
export function PublicProfileView({ userId }: { userId: string }) {
  const { user } = useAuth();
  const isOwnProfile = user?.id === userId;

  const { data: profile, isPending: profilePending, isError, refetch } = usePublicProfile(userId);
  const postsQuery = useUserBuzzPosts(userId, { includeAnonymous: isOwnProfile });

  const posts = useMemo(() => postsQuery.data?.pages.flatMap((page) => page.posts) ?? [], [postsQuery.data]);
  const postIds = useMemo(() => posts.map((p) => p.id), [posts]);
  const { data: likedPostIds } = useMyLikedPosts(postIds);
  const { data: myReports } = useMyBuzzReports();

  if (profilePending) {
    return (
      <div className="flex flex-col gap-5 px-4 py-6">
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="px-4 pt-6">
        <EmptyState
          icon={<AlertCircle className="size-7" strokeWidth={1.75} />}
          title="Couldn't load this profile"
          description="This page may not exist, or check your connection."
          actionLabel="Retry"
          onAction={() => refetch()}
          className="bg-surface shadow-card"
        />
      </div>
    );
  }

  const displayName = profile.username || "Student";
  const joinedLabel = new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const whatsappLink = profile.whatsappNumber ? buildWhatsAppLink(profile.whatsappNumber, `Hi ${displayName}, I saw your profile on Campa`) : null;
  const telLink = profile.phoneNumber ? buildTelLink(profile.phoneNumber) : null;
  const hasContact = !!whatsappLink || !!telLink;

  return (
    <div className="flex flex-col gap-5 px-4 py-6 pb-10">
      <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card">
        <div className="flex items-start gap-3">
          <UserAvatar username={profile.username} avatarColor={profile.avatarColor} size="lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="line-clamp-1 font-display text-h1 text-ink-900">{displayName}</span>
              {profile.isVerified && <VerifiedBadge label={profile.verificationLabel} />}
            </div>
            {profile.bio && <p className="text-body-sm text-ink-500">{profile.bio}</p>}
            <span className="text-caption text-ink-300">Joined {joinedLabel}</span>
          </div>
          {isOwnProfile && (
            <Link href="/profile/edit">
              <Button variant="ghost" size="sm">
                <Pencil className="size-3.5" />
                Edit
              </Button>
            </Link>
          )}
        </div>

        {hasContact && (
          <div className="flex items-center gap-2">
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-[#25D366] text-body-strong font-semibold text-white"
              >
                <MessageCircle className="size-5" />
                Chat on WhatsApp
              </a>
            )}
            {telLink && (
              <a
                href={telLink}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md border border-line text-body-strong font-semibold text-ink-700"
              >
                <Phone className="size-5" />
                Call{profile.phoneNumber ? ` ${formatDisplayPhoneNumber(profile.phoneNumber)}` : ""}
              </a>
            )}
          </div>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h1 text-ink-900">Posts ({posts.length})</h2>

        {postsQuery.isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="size-7" strokeWidth={1.75} />}
            title="No posts yet"
            description={isOwnProfile ? "Anything you post on Buzz will show up here." : `${displayName} hasn't posted on Buzz yet.`}
            className="bg-surface shadow-card"
          />
        ) : (
          <div className="flex flex-col gap-3">
            {posts.map((post, i) => (
              <div key={post.id} className="flex flex-col gap-1">
                <BuzzPostCard
                  post={post}
                  index={i}
                  isAuthorVerified={profile.isVerified}
                  authorVerificationLabel={profile.verificationLabel}
                  isLiked={likedPostIds?.has(post.id) ?? false}
                  isReported={myReports?.postIds.has(post.id) ?? false}
                />
                {isOwnProfile && post.isAnonymous && (
                  <span className="px-1 text-caption text-ink-300">Posted anonymously</span>
                )}
              </div>
            ))}

            {postsQuery.hasNextPage && (
              <Button variant="secondary" onClick={() => postsQuery.fetchNextPage()} loading={postsQuery.isFetchingNextPage}>
                Show more
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
