-- v15: correct six clear built-in exercise category mismatches.
update public.exercises
set category = case name
  when 'Mountain climber' then 'core'
  when 'Ball slam combo' then 'plyometric'
  when 'Power bag pull' then 'strength'
  when 'Single arm ball throw' then 'plyometric'
  when 'TRX push n pull' then 'strength'
  when 'Turkish get-up' then 'strength'
end
where created_by is null
  and name in (
    'Mountain climber',
    'Ball slam combo',
    'Power bag pull',
    'Single arm ball throw',
    'TRX push n pull',
    'Turkish get-up'
  );
