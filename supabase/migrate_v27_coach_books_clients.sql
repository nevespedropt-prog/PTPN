-- Sessions are arranged with the coach, so the coach can put a client into a session.
-- (Clients could already book themselves; that page is no longer offered in the app.)
create policy "bookings coach insert" on public.bookings for insert to authenticated
  with check ((select public.is_coach()));
