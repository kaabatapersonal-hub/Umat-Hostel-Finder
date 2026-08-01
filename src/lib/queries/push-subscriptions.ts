import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Upserted on endpoint -- a browser re-subscribing (e.g. after clearing
// site data) gets a new endpoint, but re-registering the *same* endpoint
// (a page reload re-running the opt-in flow) should update the row in
// place, not violate the unique constraint.
export async function savePushSubscription(
  supabase: SupabaseClient<Database>,
  userId: string,
  subscription: PushSubscriptionInput
): Promise<void> {
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { user_id: userId, endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth },
      { onConflict: "endpoint" }
    );
  if (error) throw error;
}

export async function deletePushSubscription(supabase: SupabaseClient<Database>, endpoint: string): Promise<void> {
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) throw error;
}

export async function getMyPushSubscriptionEndpoints(supabase: SupabaseClient<Database>, userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("push_subscriptions").select("endpoint").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => row.endpoint);
}
