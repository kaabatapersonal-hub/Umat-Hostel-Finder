"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Search, Users as UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { UserRow } from "@/components/admin/user-row";
import { UserDetailSheet } from "@/components/admin/user-detail-sheet";
import { useAdminUsers } from "@/hooks/use-admin-users";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { AdminUserRoleFilter } from "@/lib/queries/admin-users";
import { cn } from "@/lib/utils";

const ROLE_FILTERS: { value: AdminUserRoleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "admin", label: "Admins" },
  { value: "student", label: "Students" },
];

export default function AdminUsersPage() {
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState<AdminUserRoleFilter>("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useAdminUsers({
    search: debouncedSearch,
    roleFilter,
  });
  const users = useMemo(() => data?.pages.flatMap((page) => page.users) ?? [], [data]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-h1 text-ink-900">Users</h1>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="flex h-12 flex-1 items-center gap-2.5 rounded-md bg-surface px-3.5 shadow-card">
          <Search className="size-5 shrink-0 text-ink-300" />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by name or email..."
            aria-label="Search users"
            className="w-full bg-transparent text-body text-ink-900 placeholder:text-ink-300 focus:outline-none"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {ROLE_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setRoleFilter(value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-body-sm font-medium transition-colors",
                roleFilter === value ? "bg-brand-800 text-white" : "bg-surface text-ink-500 shadow-card hover:bg-surface-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={<AlertCircle className="size-7" strokeWidth={1.75} />}
          title="Couldn't load users"
          description="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => refetch()}
          className="bg-surface shadow-card"
        />
      ) : users.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="size-7" strokeWidth={1.75} />}
          title="No users found"
          description="Try a different search or filter."
          className="bg-surface shadow-card"
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {users.map((user) => (
              <UserRow key={user.id} user={user} onSelect={setSelectedUserId} />
            ))}
          </div>

          {hasNextPage && (
            <Button variant="secondary" onClick={() => fetchNextPage()} loading={isFetchingNextPage} className="self-center">
              Load more
            </Button>
          )}
        </>
      )}

      <UserDetailSheet userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
    </div>
  );
}
