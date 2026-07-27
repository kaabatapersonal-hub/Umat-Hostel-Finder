"use client";

import { Users, UserPlus, Activity, Heart, MessageSquare, Star } from "lucide-react";
import { AnalyticsStatCard, AnalyticsStatCardSkeleton, AnalyticsStatCardError } from "@/components/admin/analytics-stat-card";
import {
  useAdminUserGrowth,
  useAdminActiveUsers,
  useAdminEngagementStats,
} from "@/hooks/use-admin-analytics";
import { ANALYTICS_ACTIVE_WINDOW_DAYS, ANALYTICS_GROWTH_WINDOW_DAYS } from "@/lib/queries/admin-analytics";

function formatDelta(count: number, days: number): string {
  return `+${count.toLocaleString()} in last ${days} days`;
}

export default function AdminAnalyticsPage() {
  const userGrowth = useAdminUserGrowth();
  const activeUsers = useAdminActiveUsers();
  const engagement = useAdminEngagementStats();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-h1 text-ink-900">Analytics</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-body-strong font-semibold text-ink-900">Growth</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {userGrowth.isPending ? (
            <>
              <AnalyticsStatCardSkeleton />
              <AnalyticsStatCardSkeleton />
            </>
          ) : userGrowth.isError ? (
            <>
              <AnalyticsStatCardError label="Total users" icon={Users} />
              <AnalyticsStatCardError label="Sign-ups (30d)" icon={UserPlus} />
            </>
          ) : (
            <>
              <AnalyticsStatCard
                label="Total users"
                icon={Users}
                value={userGrowth.data.totalUsers}
                deltaLabel={formatDelta(userGrowth.data.signups30d, ANALYTICS_GROWTH_WINDOW_DAYS)}
                deltaIsPositive={userGrowth.data.signups30d > 0}
              />
              <AnalyticsStatCard
                label="Sign-ups (30d)"
                icon={UserPlus}
                value={userGrowth.data.signups30d}
                deltaLabel={`All time: ${userGrowth.data.totalUsers.toLocaleString()}`}
              />
            </>
          )}

          {activeUsers.isPending ? (
            <AnalyticsStatCardSkeleton />
          ) : activeUsers.isError ? (
            <AnalyticsStatCardError label="Active users (7d)" icon={Activity} />
          ) : (
            <AnalyticsStatCard
              label="Active users (7d)"
              icon={Activity}
              value={activeUsers.data}
              deltaLabel={`in the last ${ANALYTICS_ACTIVE_WINDOW_DAYS} days`}
              caption="Saved a hostel, posted a review, posted on Buzz, or listed a marketplace item in the last 7 days."
            />
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-body-strong font-semibold text-ink-900">Engagement</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {engagement.isPending ? (
            <>
              <AnalyticsStatCardSkeleton />
              <AnalyticsStatCardSkeleton />
              <AnalyticsStatCardSkeleton />
            </>
          ) : engagement.isError ? (
            <>
              <AnalyticsStatCardError label="Hostels saved" icon={Heart} />
              <AnalyticsStatCardError label="Buzz posts" icon={MessageSquare} />
              <AnalyticsStatCardError label="Reviews" icon={Star} />
            </>
          ) : (
            <>
              <AnalyticsStatCard
                label="Hostels saved"
                icon={Heart}
                value={engagement.data.totalSaves}
                deltaLabel={formatDelta(engagement.data.saves30d, ANALYTICS_GROWTH_WINDOW_DAYS)}
                deltaIsPositive={engagement.data.saves30d > 0}
              />
              <AnalyticsStatCard
                label="Buzz posts"
                icon={MessageSquare}
                value={engagement.data.totalBuzzPosts}
                deltaLabel={formatDelta(engagement.data.buzzPosts30d, ANALYTICS_GROWTH_WINDOW_DAYS)}
                deltaIsPositive={engagement.data.buzzPosts30d > 0}
              />
              <AnalyticsStatCard
                label="Reviews"
                icon={Star}
                value={engagement.data.totalReviews}
                deltaLabel={formatDelta(engagement.data.reviews30d, ANALYTICS_GROWTH_WINDOW_DAYS)}
                deltaIsPositive={engagement.data.reviews30d > 0}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
