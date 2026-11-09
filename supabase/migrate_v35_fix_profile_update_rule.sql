-- v35: fix. The profiles UPDATE rule that stops a user changing their own role read the profiles table
-- from inside the profiles policy, so every profile update (client or coach) failed with
-- "infinite recursion detected in policy for relation profiles". The role lookup now goes through a small
-- SECURITY DEFINER function, the same way is_coach() already does, so the rule no longer refers to its own table.
--
-- After this: a user can update their own profile but cannot change their role or anyone else's profile;
-- the coach can update any profile. Safe to run twice.
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;
revoke all on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated, service_role;

drop policy if exists "profiles update own or coach" on public.profiles;
create policy "profiles update own or coach" on public.profiles for update to public
  using ((id = (select auth.uid())) or public.is_coach())
  with check (
    public.is_coach()
    or ((id = (select auth.uid())) and (role = (select public.my_role())))
  );
