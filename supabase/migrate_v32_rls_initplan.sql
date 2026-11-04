-- v32: speed. Row-level-security rules that call auth.uid(), auth.role() or auth.jwt() directly are
-- re-evaluated for every row. Wrapping the call in (select ...) makes Postgres evaluate it once per query.
-- The result is identical, only faster. This rewrites every such rule in the public schema in place.
--
-- To undo: replace "( SELECT auth.uid() AS uid)" with "auth.uid()" in the same way (same for role and jwt).
do $$
declare
  r record;
  q text;
  w text;
  stmt text;
  n int := 0;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ~ '(?<!SELECT )auth\.(uid|role|jwt)\(\)'
        or coalesce(with_check, '') ~ '(?<!SELECT )auth\.(uid|role|jwt)\(\)')
  loop
    q := regexp_replace(r.qual, '(?<!SELECT )(auth\.(uid|role|jwt)\(\))', '(select \1)', 'g');
    w := regexp_replace(r.with_check, '(?<!SELECT )(auth\.(uid|role|jwt)\(\))', '(select \1)', 'g');
    stmt := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if r.qual is not null then stmt := stmt || ' using (' || q || ')'; end if;
    if r.with_check is not null then stmt := stmt || ' with check (' || w || ')'; end if;
    execute stmt;
    n := n + 1;
  end loop;
  raise notice 'wrapped % policies', n;
end $$;
