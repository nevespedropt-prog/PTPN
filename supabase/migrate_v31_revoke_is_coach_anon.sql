-- v31: signed-out visitors can no longer call public.is_coach() through the API.
-- Applied to the live project on 4 Nov 2026. Signed-in users and the service role keep access,
-- and no signed-out query in the app or the website reads a table whose rules use is_coach().
revoke all on function public.is_coach() from public, anon;
grant execute on function public.is_coach() to authenticated, service_role;
