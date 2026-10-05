-- v4: push notifications. Run once in the SQL editor on an existing database.
-- Part 1: tables. Part 2: triggers and schedules (need the pg_net and pg_cron extensions).

-- ========== v4: push notifications (tables) ==========
-- One row per browser/phone that turned notifications on.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "push own read" on public.push_subscriptions for select using (user_id = auth.uid());
create policy "push own insert" on public.push_subscriptions for insert with check (user_id = auth.uid());
create policy "push own update" on public.push_subscriptions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push own delete" on public.push_subscriptions for delete using (user_id = auth.uid());

-- Server-only settings (VAPID keys, shared secret, app address). RLS is on with no policies and
-- no grants, so only the service role (the send-push function) can read it.
create table if not exists public.push_config (
  id int primary key default 1 check (id = 1),
  vapid_public text not null,
  vapid_private text not null,
  subject text not null default 'mailto:nevespedro.pt@gmail.com',
  secret text not null,
  app_url text not null
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

-- The public half of the key is safe to share: the app needs it to subscribe.
create or replace function public.push_public_key() returns text
language sql stable security definer set search_path = public as $$
  select vapid_public from public.push_config where id = 1 $$;
revoke execute on function public.push_public_key() from public, anon;
grant execute on function public.push_public_key() to authenticated;

-- Announcements are pushed once; scheduled ones go out when their time arrives.
alter table public.posts add column if not exists pushed_at timestamptz;

-- Posts that already exist should not be announced again.
update public.posts set pushed_at = now() where pushed_at is null;

-- ========== Part 2: triggers and schedules ==========
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Calls the send-push edge function. Never lets a failed push block the write that caused it.
create or replace function public.notify_push(payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select * into c from public.push_config where id = 1;
  if c.secret is null then return; end if;
  perform net.http_post(
    url := 'https://dstxexfkxejmolnulwli.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', c.secret),
    body := payload
  );
exception when others then
  null;
end $$;
revoke execute on function public.notify_push(jsonb) from public, anon, authenticated;

create or replace function public.push_on_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_push(jsonb_build_object('kind', 'message', 'id', new.id));
  return new;
end $$;
revoke execute on function public.push_on_message() from public, anon, authenticated;
drop trigger if exists push_message on public.messages;
create trigger push_message after insert on public.messages for each row execute function public.push_on_message();

create or replace function public.push_on_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.publish_at <= now() then
    perform public.notify_push(jsonb_build_object('kind', 'posts'));
  end if;
  return new;
end $$;
revoke execute on function public.push_on_post() from public, anon, authenticated;
drop trigger if exists push_post on public.posts;
create trigger push_post after insert on public.posts for each row execute function public.push_on_post();

-- Scheduled announcements (every 5 minutes) and the morning workout reminder (07:00 UTC, 8am in London in summer).
select cron.unschedule(jobid) from cron.job where jobname in ('push-posts', 'push-reminders');
select cron.schedule('push-posts', '*/5 * * * *', $$select public.notify_push('{"kind":"posts"}'::jsonb)$$);
select cron.schedule('push-reminders', '0 7 * * *', $$select public.notify_push('{"kind":"reminders"}'::jsonb)$$);
