
-- Run this after the original schema.sql.
create table if not exists public.artist_profiles (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('Spotify','Apple Music','Anghami','YouTube Music','Deezer','TikTok')),
  profile_url text,
  profile_id text,
  has_profile boolean not null default true,
  status text not null default 'connected' check (status in ('connected','requested','pending','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(artist_id, platform)
);

create table if not exists public.profile_requests (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null,
  release_id uuid references public.releases(id) on delete set null,
  status text not null default 'requested' check (status in ('requested','processing','created','rejected')),
  note text,
  created_at timestamptz not null default now()
);

alter table public.artist_profiles enable row level security;
alter table public.profile_requests enable row level security;

drop policy if exists "profiles own read" on public.artist_profiles;
create policy "profiles own read" on public.artist_profiles for select
using (artist_id = auth.uid() or public.is_admin());

drop policy if exists "profiles own insert" on public.artist_profiles;
create policy "profiles own insert" on public.artist_profiles for insert
with check (artist_id = auth.uid() or public.is_admin());

drop policy if exists "profiles own update" on public.artist_profiles;
create policy "profiles own update" on public.artist_profiles for update
using (artist_id = auth.uid() or public.is_admin());

drop policy if exists "requests own read" on public.profile_requests;
create policy "requests own read" on public.profile_requests for select
using (artist_id = auth.uid() or public.is_admin());

drop policy if exists "requests own insert" on public.profile_requests;
create policy "requests own insert" on public.profile_requests for insert
with check (artist_id = auth.uid());

drop policy if exists "requests admin update" on public.profile_requests;
create policy "requests admin update" on public.profile_requests for update
using (public.is_admin());

-- Optional storage buckets. Create these in Storage if your project UI doesn't allow SQL bucket creation:
-- covers (public or private)
-- audio (private)
