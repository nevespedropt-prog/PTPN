-- v38: moving a booked session (coach changes its date) re-arms the client's reminder,
-- so they get the eight-hour reminder for the new time and not a stale one for the old time.
-- Re-runnable.
create or replace function public.reset_booking_reminder()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.bookings set reminder_sent_at = null where session_id = new.id;
  return new;
end $$;
revoke execute on function public.reset_booking_reminder() from public, anon, authenticated;

drop trigger if exists sessions_moved_reset_reminder on public.sessions;
create trigger sessions_moved_reset_reminder after update of starts_at on public.sessions
  for each row when (old.starts_at is distinct from new.starts_at) execute function public.reset_booking_reminder();
