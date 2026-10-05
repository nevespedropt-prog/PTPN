-- Instagram reels shown on the Resources page. Safe to re-run.
insert into public.resources (id, title, url, category, description, created_at) values
  (extensions.uuid_generate_v5('6f1c1e4a-8d3b-4c55-9a9e-5b1d2e7c0a11', 'video:DU3K2QbjNZr'), 'Video 1', 'https://www.instagram.com/reel/DU3K2QbjNZr/', 'Videos', '', now() - interval '15 seconds'),
  (extensions.uuid_generate_v5('6f1c1e4a-8d3b-4c55-9a9e-5b1d2e7c0a11', 'video:DUeHMVvjJzj'), 'Video 2', 'https://www.instagram.com/reel/DUeHMVvjJzj/', 'Videos', '', now() - interval '14 seconds'),
  (extensions.uuid_generate_v5('6f1c1e4a-8d3b-4c55-9a9e-5b1d2e7c0a11', 'video:DUQvX0SDH_X'), 'Video 3', 'https://www.instagram.com/reel/DUQvX0SDH_X/', 'Videos', '', now() - interval '13 seconds'),
  (extensions.uuid_generate_v5('6f1c1e4a-8d3b-4c55-9a9e-5b1d2e7c0a11', 'video:DLuv6JTtI7P'), 'Video 4', 'https://www.instagram.com/reel/DLuv6JTtI7P/', 'Videos', '', now() - interval '12 seconds'),
  (extensions.uuid_generate_v5('6f1c1e4a-8d3b-4c55-9a9e-5b1d2e7c0a11', 'video:DJWnVG_Nbnf'), 'Video 5', 'https://www.instagram.com/reel/DJWnVG_Nbnf/', 'Videos', '', now() - interval '11 seconds'),
  (extensions.uuid_generate_v5('6f1c1e4a-8d3b-4c55-9a9e-5b1d2e7c0a11', 'video:DH3uDqTNuUl'), 'Video 6', 'https://www.instagram.com/reel/DH3uDqTNuUl/', 'Videos', '', now() - interval '10 seconds'),
  (extensions.uuid_generate_v5('6f1c1e4a-8d3b-4c55-9a9e-5b1d2e7c0a11', 'video:DF8PkxYtovm'), 'Video 7', 'https://www.instagram.com/reel/DF8PkxYtovm/', 'Videos', '', now() - interval '9 seconds'),
  (extensions.uuid_generate_v5('6f1c1e4a-8d3b-4c55-9a9e-5b1d2e7c0a11', 'video:DFe6Qt9Nh-n'), 'Video 8', 'https://www.instagram.com/reel/DFe6Qt9Nh-n/', 'Videos', '', now() - interval '8 seconds'),
  (extensions.uuid_generate_v5('6f1c1e4a-8d3b-4c55-9a9e-5b1d2e7c0a11', 'video:DFLUENgMYEN'), 'Video 9', 'https://www.instagram.com/reel/DFLUENgMYEN/', 'Videos', '', now() - interval '7 seconds'),
  (extensions.uuid_generate_v5('6f1c1e4a-8d3b-4c55-9a9e-5b1d2e7c0a11', 'video:DHGrPJLNQbO'), 'Video 10', 'https://www.instagram.com/reel/DHGrPJLNQbO/', 'Videos', '', now() - interval '6 seconds'),
  (extensions.uuid_generate_v5('6f1c1e4a-8d3b-4c55-9a9e-5b1d2e7c0a11', 'video:DIjclbptvSO'), 'Video 11', 'https://www.instagram.com/reel/DIjclbptvSO/', 'Videos', '', now() - interval '5 seconds'),
  (extensions.uuid_generate_v5('6f1c1e4a-8d3b-4c55-9a9e-5b1d2e7c0a11', 'video:DJ8lKEONTzX'), 'Video 12', 'https://www.instagram.com/reel/DJ8lKEONTzX/', 'Videos', '', now() - interval '4 seconds'),
  (extensions.uuid_generate_v5('6f1c1e4a-8d3b-4c55-9a9e-5b1d2e7c0a11', 'video:DLKlmBpt3Vz'), 'Video 13', 'https://www.instagram.com/reel/DLKlmBpt3Vz/', 'Videos', '', now() - interval '3 seconds'),
  (extensions.uuid_generate_v5('6f1c1e4a-8d3b-4c55-9a9e-5b1d2e7c0a11', 'video:DSNb4vcDCdU'), 'Video 14', 'https://www.instagram.com/reel/DSNb4vcDCdU/', 'Videos', '', now() - interval '2 seconds'),
  (extensions.uuid_generate_v5('6f1c1e4a-8d3b-4c55-9a9e-5b1d2e7c0a11', 'video:DRzGfijDBaQ'), 'Video 15', 'https://www.instagram.com/reel/DRzGfijDBaQ/', 'Videos', '', now() - interval '1 seconds')
on conflict (id) do nothing;
