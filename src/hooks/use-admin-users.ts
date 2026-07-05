"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getAdminUsers, type AdminUserRoleFilter, type AdminUserSort } from "@/lib/queries/admin-users";

export function useAdminUsers({
  search,
  roleFilter = "all",
  sort = "newest",
}: {
  search?: string;
  roleFilter?: AdminUserRoleFilter;
  sort?: AdminUserSort;
} = {}) {
  const supabase = useMemo(() => createClient(), []);

  return useInfiniteQuery({
    queryKey: ["admin-users", search ?? "", roleFilter, sort] as const,
    queryFn: ({ pageParam }) => getAdminUsers(supabase, { search, roleFilter, sort, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });
}
