-- MycoDex UK — run in a NEW Supabase project's SQL Editor.
-- Personal sightings and photographs are accessible only by their owner.
-- Safe to re-run, but review existing policies before reusing in another app.

create table if not exists public.mycodex_finds (
  user_id uuid not null references auth.users (id) on delete cascade,
  species_id text not null,
  found_date date,
  location text not null default '',
  notes text not null default '',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id,species_id)
);
create table if not exists public.mycodex_photos (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  species_id text not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists mycodex_photos_user_idx on public.mycodex_photos(user_id);

alter table public.mycodex_finds enable row level security;
alter table public.mycodex_photos enable row level security;
revoke all on public.mycodex_finds, public.mycodex_photos from anon;
grant select,insert,update,delete on public.mycodex_finds, public.mycodex_photos to authenticated;

-- Explicit CRUD permissions on the data belonging to the authenticated user.
drop policy if exists "mycodex finds select own" on public.mycodex_finds;
create policy "mycodex finds select own" on public.mycodex_finds for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "mycodex finds insert own" on public.mycodex_finds;
create policy "mycodex finds insert own" on public.mycodex_finds for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "mycodex finds update own" on public.mycodex_finds;
create policy "mycodex finds update own" on public.mycodex_finds for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "mycodex finds delete own" on public.mycodex_finds;
create policy "mycodex finds delete own" on public.mycodex_finds for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "mycodex photos select own" on public.mycodex_photos;
create policy "mycodex photos select own" on public.mycodex_photos for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "mycodex photos insert own" on public.mycodex_photos;
create policy "mycodex photos insert own" on public.mycodex_photos for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "mycodex photos update own" on public.mycodex_photos;
create policy "mycodex photos update own" on public.mycodex_photos for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "mycodex photos delete own" on public.mycodex_photos;
create policy "mycodex photos delete own" on public.mycodex_photos for delete to authenticated using ((select auth.uid()) = user_id);

-- All files private. Names are prefixed by authenticated user's UUID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('mycodex-photos','mycodex-photos',false,5242880,array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "mycodex storage read own" on storage.objects;
create policy "mycodex storage read own" on storage.objects for select to authenticated
using (bucket_id='mycodex-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "mycodex storage upload own" on storage.objects;
create policy "mycodex storage upload own" on storage.objects for insert to authenticated
with check (bucket_id='mycodex-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "mycodex storage delete own" on storage.objects;
create policy "mycodex storage delete own" on storage.objects for delete to authenticated
using (bucket_id='mycodex-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);