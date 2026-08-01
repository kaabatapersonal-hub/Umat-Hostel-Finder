import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, NotificationType } from "@/lib/supabase/database.types";

export type NotificationReferenceType = "buzz_post" | "buzz_reply" | "hostel" | "buzz_report";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  actorId: string | null;
  actorName: string | null;
  referenceType: NotificationReferenceType | null;
  referenceId: string | null;
  linkUrl: string | null;
  groupCount: number;
  isRead: boolean;
  createdAt: string;
}

const NOTIFICATION_COLUMNS =
  "id, type, title, body, actor_id, actor_name, reference_type, reference_id, link_url, group_count, is_read, created_at";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  actor_id: string | null;
  actor_name: string | null;
  reference_type: string | null;
  reference_id: string | null;
  link_url: string | null;
  group_count: number;
  is_read: boolean;
  created_at: string;
}

export function mapNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    actorId: row.actor_id,
    actorName: row.actor_name,
    referenceType: row.reference_type as NotificationReferenceType | null,
    referenceId: row.reference_id,
    linkUrl: row.link_url,
    groupCount: row.group_count,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

export const NOTIFICATIONS_PAGE_SIZE = 20;

export interface NotificationCursor {
  createdAt: string;
  id: string;
}

export interface GetNotificationsResult {
  notifications: AppNotification[];
  nextCursor: NotificationCursor | null;
}

// Keyset (cursor) pagination, same shape as getBuzzFeed -- newest first,
// the recipient's own rows only (RLS already enforces this; the explicit
// filter here is defense in depth, same posture as every other batched
// query in this app).
export async function getNotifications(
  supabase: SupabaseClient<Database>,
  userId: string,
  { cursor, limit = NOTIFICATIONS_PAGE_SIZE }: { cursor?: NotificationCursor | null; limit?: number } = {}
): Promise<GetNotificationsResult> {
  let query = supabase
    .from("notifications")
    .select(NOTIFICATION_COLUMNS)
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (cursor) {
    query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const notifications = (data ?? []).map(mapNotification);
  const last = notifications[notifications.length - 1];
  const nextCursor = notifications.length === limit && last ? { createdAt: last.createdAt, id: last.id } : null;

  return { notifications, nextCursor };
}

export async function getUnreadNotificationsCount(supabase: SupabaseClient<Database>): Promise<number> {
  const { data, error } = await supabase.rpc("get_unread_notifications_count");
  if (error) throw error;
  return data ?? 0;
}

export async function markNotificationRead(supabase: SupabaseClient<Database>, notificationId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_notification_read", { p_notification_id: notificationId });
  if (error) throw error;
}

export async function markAllNotificationsRead(supabase: SupabaseClient<Database>): Promise<void> {
  const { error } = await supabase.rpc("mark_all_notifications_read");
  if (error) throw error;
}

// Admin-only (gated by send_broadcasts inside the RPC itself, not just the
// UI) -- one notification row per non-suspended user, reusing the existing
// delivery pipeline (bell, realtime, and eventually push) rather than a
// separate broadcast system. Returns how many users it actually reached.
export async function sendAdminBroadcast(
  supabase: SupabaseClient<Database>,
  { title, body, link }: { title: string; body: string; link?: string | null }
): Promise<number> {
  const { data, error } = await supabase.rpc("send_admin_broadcast", { p_title: title, p_body: body, p_link: link ?? null });
  if (error) throw error;
  return data ?? 0;
}
