-- v33: speed. A foreign key without an index makes deletes and joins on that column scan the whole table.
-- This adds a plain index for every foreign key in the public schema that has no index starting with its columns.
-- Safe to run twice: keys that already have an index are skipped.
--
-- To undo: drop the indexes whose names start with "fk_idx_".
do $$
declare
  r record;
  idx text;
  n int := 0;
begin
  for r in
    select c.conrelid::regclass as tbl,
           c.conrelid,
           c.conkey,
           (select string_agg(quote_ident(a.attname), ', ' order by k.ord)
              from unnest(c.conkey) with ordinality as k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as cols,
           (select string_agg(a.attname, '_' order by k.ord)
              from unnest(c.conkey) with ordinality as k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as colnames,
           (select relname from pg_class where oid = c.conrelid) as relname
    from pg_constraint c
    where c.contype = 'f'
      and c.connamespace = 'public'::regnamespace
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid
          and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey
          and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] <@ c.conkey
      )
  loop
    idx := left('fk_idx_' || r.relname || '_' || r.colnames, 63);
    execute format('create index if not exists %I on %s (%s)', idx, r.tbl, r.cols);
    n := n + 1;
  end loop;
  raise notice 'added % foreign key indexes', n;
end $$;
