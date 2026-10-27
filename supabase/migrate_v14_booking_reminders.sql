-- v14: one-time push reminder when a booked PT session is eight hours away.

alter table public.bookings add column if not exists reminder_sent_at timestamptz;
create index if not exists bookings_reminder_pending on public.bookings (session_id) where reminder_sent_at is null;

create or replace function public.claim_booking_reminders()
returns table (booking_id uuid, client_id uuid, starts_at timestamptz, title text)
language sql volatile security invoker set search_path = public as $$
  with due as (
    select b.id
    from public.bookings b
    join public.sessions s on s.id = b.session_id
    where b.reminder_sent_at is null
      and s.starts_at > now()
      and s.starts_at <= now() + interval '8 hours'
    order by s.starts_at
    for update of b skip locked
  )
  update public.bookings b
  set reminder_sent_at = now()
  from due, public.sessions s
  where b.id = due.id and s.id = b.session_id
  returning b.id, b.client_id, s.starts_at, s.title
$$;
revoke execute on function public.claim_booking_reminders() from public, anon, authenticated;
grant execute on function public.claim_booking_reminders() to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'push-booking-reminders';
select cron.schedule(
  'push-booking-reminders',
  '*/5 * * * *',
  $$select public.notify_push('{"kind":"booking-reminders"}'::jsonb)$$
);

