-- YOUNG BOYZ DISTRIBUTION V5
-- Run this AFTER schema-v2.sql and schema-v3.sql (Supabase > SQL Editor).
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1) Release columns used by the new submit form (drafts, date/time, files)
-- ---------------------------------------------------------------------------
alter table public.releases add column if not exists artist_name text;
alter table public.releases add column if not exists release_mode text default 'date';   -- 'today' | 'date'
alter table public.releases add column if not exists release_time text;                  -- 24h "HH:MM"
alter table public.releases add column if not exists release_tz text;                   -- e.g. Africa/Cairo
alter table public.releases add column if not exists genre text;
alter table public.releases add column if not exists sub_genre text;
alter table public.releases add column if not exists pitch text;
alter table public.releases add column if not exists notes text;
alter table public.releases add column if not exists artwork_by text;
alter table public.releases add column if not exists cover_path text;
alter table public.releases add column if not exists cover_name text;
alter table public.releases add column if not exists cover_size bigint;
alter table public.releases add column if not exists dsp_profiles jsonb not null default '{}'::jsonb;
alter table public.releases add column if not exists confirm_no_ai boolean not null default false;
alter table public.releases add column if not exists confirm_original boolean not null default false;
alter table public.releases add column if not exists confirm_terms boolean not null default false;
alter table public.releases add column if not exists submitted_at timestamptz;
alter table public.releases add column if not exists updated_at timestamptz not null default now();

-- The old CHECK constraints (if any) may not allow 'draft' / 'mixtape' / 'compilation'. Replace them.
alter table public.releases drop constraint if exists releases_status_check;
alter table public.releases drop constraint if exists releases_release_type_check;
alter table public.releases add constraint releases_status_check
  check (status in ('draft','submitted','qa','pending','approved','rejected','delivered','live')) not valid;
alter table public.releases add constraint releases_release_type_check
  check (release_type in ('single','ep','album','mixtape','compilation')) not valid;

-- ---------------------------------------------------------------------------
-- 2) Tracks
-- ---------------------------------------------------------------------------
create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.releases(id) on delete cascade,
  artist_id uuid not null references public.profiles(id) on delete cascade,
  position int not null default 1,
  title text,
  version text,                 -- e.g. "Remix", "Instrumental"
  featured_artists text,
  explicit text not null default 'no' check (explicit in ('no','yes','clean')),
  isrc text,
  language text,
  lyrics text,
  contributors jsonb not null default '[]'::jsonb,   -- [{name, role}]
  audio_path text,
  audio_name text,
  audio_size bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tracks_release_idx on public.tracks(release_id, position);

alter table public.tracks enable row level security;

drop policy if exists "tracks v4 read" on public.tracks;
create policy "tracks v4 read" on public.tracks for select
using (artist_id = auth.uid() or public.is_admin());

drop policy if exists "tracks v4 insert" on public.tracks;
create policy "tracks v4 insert" on public.tracks for insert
with check (artist_id = auth.uid() or public.is_admin());

drop policy if exists "tracks v4 update" on public.tracks;
create policy "tracks v4 update" on public.tracks for update
using (artist_id = auth.uid() or public.is_admin());

drop policy if exists "tracks v4 delete" on public.tracks;
create policy "tracks v4 delete" on public.tracks for delete
using (artist_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- 3) Releases RLS: artists see/edit their own (drafts auto-save), admins see all
-- ---------------------------------------------------------------------------
alter table public.releases enable row level security;

drop policy if exists "releases v4 read" on public.releases;
create policy "releases v4 read" on public.releases for select
using (artist_id = auth.uid() or public.is_admin());

drop policy if exists "releases v4 insert" on public.releases;
create policy "releases v4 insert" on public.releases for insert
with check (artist_id = auth.uid() or public.is_admin());

drop policy if exists "releases v4 update" on public.releases;
create policy "releases v4 update" on public.releases for update
using (artist_id = auth.uid() or public.is_admin());

drop policy if exists "releases v4 delete" on public.releases;
create policy "releases v4 delete" on public.releases for delete
using ((artist_id = auth.uid() and status = 'draft') or public.is_admin());

-- Platform profiles are limited to Spotify + Apple Music now. Keep old rows valid.
alter table public.artist_profiles drop constraint if exists artist_profiles_platform_check;
alter table public.artist_profiles add constraint artist_profiles_platform_check
  check (platform in ('Spotify','Apple Music','Anghami','YouTube Music','Deezer','TikTok'));
alter table public.artist_profiles drop constraint if exists artist_profiles_status_check;
alter table public.artist_profiles add constraint artist_profiles_status_check
  check (status in ('connected','requested','pending','rejected','not connected'));

-- ---------------------------------------------------------------------------
-- 4) Security: nobody can promote themselves to admin
--    (the service-role key used by the edge functions has auth.uid() = null and is allowed)
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only an admin can change roles';
  end if;
  return new;
end $$;

drop trigger if exists guard_profile_role on public.profiles;
create trigger guard_profile_role before update on public.profiles
for each row execute function public.guard_profile_role();

-- ---------------------------------------------------------------------------
-- 5) Make YOUR account the admin (replace the email, then run):
-- ---------------------------------------------------------------------------
-- update public.profiles set role = 'admin' where email = 'rotinima3@gmail.com';
