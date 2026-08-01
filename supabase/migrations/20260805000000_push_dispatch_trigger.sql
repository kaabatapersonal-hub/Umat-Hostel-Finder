-- Push notification dispatch trigger -- SQL-native, sidesteps the
-- Supabase Dashboard's Database Webhooks UI entirely, which failed on
-- this project ("schema supabase_functions does not exist") even after
-- enabling pg_net. This achieves the exact same thing directly: an
-- AFTER INSERT trigger on notifications posts the new row to the
-- deployed /api/push/dispatch route via pg_net, which looks up the
-- recipient's real push subscriptions and sends the actual OS push.
--
-- The webhook secret is read from app_secrets (the same deny-all table
-- already used for push_dispatch_secret, see 20260804000000) at trigger
-- time, never hardcoded here -- if it's ever rotated, only that one row
-- needs to change, not this function.

create extension if not exists pg_net;

create or replace function public.dispatch_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  select value into v_secret from public.app_secrets where key = 'push_dispatch_secret';

  -- Not configured yet -- silently no-op rather than block the
  -- notification insert itself. Push delivery is best-effort; the
  -- in-app notification (already committed by the time this trigger
  -- runs) is the real, guaranteed delivery path regardless.
  if v_secret is null or v_secret = '' then
    return new;
  end if;

  -- Fire-and-forget: net.http_post queues the request for pg_net's own
  -- background worker and returns immediately, so this never blocks (or
  -- can fail) the notification insert itself on network latency.
  perform net.http_post(
    url := 'https://campagh.app/api/push/dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notifications',
      'record', jsonb_build_object(
        'id', new.id,
        'recipient_id', new.recipient_id,
        'title', new.title,
        'body', new.body,
        'link_url', new.link_url,
        'reference_type', new.reference_type,
        'reference_id', new.reference_id
      )
    )
  );

  return new;
end;
$$;

drop trigger if exists notifications_dispatch_push on public.notifications;
create trigger notifications_dispatch_push
  after insert on public.notifications
  for each row execute function public.dispatch_push_notification();

notify pgrst, 'reload schema';
