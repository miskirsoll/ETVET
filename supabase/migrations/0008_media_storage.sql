-- Media storage for course assets (images, video, audio, logos, cover
-- photos): a single public 'media' bucket, org-scoped by path prefix
-- (org_id/filename), the same way every other table in this schema is
-- scoped by org_id -- just enforced on storage.objects instead of a
-- regular table.
--
-- UNVERIFIED: unlike every other migration in this repo, this one has
-- NOT been run against a real Postgres/Storage instance. The sandbox
-- this was built in has no Docker daemon, and Supabase Storage (the
-- actual file-serving service, not just this metadata table) only runs
-- as part of the Docker-based local stack or a hosted project -- there
-- is no way to exercise a real upload without one of those. The SQL
-- follows Supabase's documented storage.objects RLS pattern exactly, but
-- run `supabase start` and upload a real file before trusting this in
-- production; do not assume it's correct just because it applies cleanly.
--
-- The bucket is public: anyone with a file's URL can read it, whether or
-- not the course it belongs to is published. This mirrors how most
-- course platforms serve media (a long, unguessable path is the actual
-- protection, not an auth check on every asset request) and keeps
-- published courses genuinely self-contained. A stricter model -- signed
-- URLs gated on the course's current publish status -- is a viable
-- follow-up if that trade-off turns out to matter.

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "org members upload to own org folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = public.current_org_id()::text);

create policy "org members update own org files" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = public.current_org_id()::text);

create policy "org members delete own org files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = public.current_org_id()::text);

-- Belt-and-suspenders alongside the bucket's own public flag (which lets
-- the dedicated public-URL endpoint bypass RLS entirely) -- covers the
-- authenticated Storage API/listing path too, e.g. a future media library.
create policy "anyone reads the media bucket" on storage.objects
  for select using (bucket_id = 'media');
