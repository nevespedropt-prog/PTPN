-- v42: the coach can delete a client's body measurements (they could already add and change them).
-- A client still deletes their own. Re-runnable.
drop policy if exists "meas delete own" on public.measurements;
drop policy if exists "meas delete own or coach" on public.measurements;
create policy "meas delete own or coach" on public.measurements for delete
  using (client_id = (select auth.uid()) or (select public.is_coach()));
