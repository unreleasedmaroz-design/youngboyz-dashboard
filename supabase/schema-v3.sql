-- YOUNGBOYZ DISTRIBUTION V3
-- Run this AFTER schema-v2.sql.

alter table public.profiles add column if not exists email text;

-- Storage buckets
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true), ('audio', 'audio', false)
on conflict (id) do update set public = excluded.public;

-- Cover images: public read, artists upload only into their own folder.
drop policy if exists "covers public read" on storage.objects;
create policy "covers public read" on storage.objects for select
using (bucket_id = 'covers');

drop policy if exists "covers artist upload" on storage.objects;
create policy "covers artist upload" on storage.objects for insert
with check (
  bucket_id = 'covers'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "covers artist update" on storage.objects;
create policy "covers artist update" on storage.objects for update
using (
  bucket_id = 'covers'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
)
with check (
  bucket_id = 'covers'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

drop policy if exists "covers artist delete" on storage.objects;
create policy "covers artist delete" on storage.objects for delete
using (
  bucket_id = 'covers'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

-- Audio: private; only the artist who owns the folder or an admin can read/write.
drop policy if exists "audio artist read" on storage.objects;
create policy "audio artist read" on storage.objects for select
using (
  bucket_id = 'audio'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

drop policy if exists "audio artist upload" on storage.objects;
create policy "audio artist upload" on storage.objects for insert
with check (
  bucket_id = 'audio'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "audio artist update" on storage.objects;
create policy "audio artist update" on storage.objects for update
using (
  bucket_id = 'audio'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
)
with check (
  bucket_id = 'audio'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

drop policy if exists "audio artist delete" on storage.objects;
create policy "audio artist delete" on storage.objects for delete
using (
  bucket_id = 'audio'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);
