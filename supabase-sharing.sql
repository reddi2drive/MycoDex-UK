-- MycoDex UK: add a private, email-invited shared collection.
-- Run once in your MycoDex Supabase SQL Editor, AFTER supabase-setup.sql.
-- Existing discoveries and photographs are preserved.
create table if not exists public.mycodex_shares (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  invited_email text not null,
  created_at timestamptz not null default now(),
  primary key(owner_user_id, invited_email),
  constraint mycodex_normalised_email check (invited_email=lower(btrim(invited_email)))
);
create index if not exists mycodex_shares_invited_email_idx on public.mycodex_shares(invited_email);
alter table public.mycodex_shares enable row level security;
revoke all on public.mycodex_shares from anon;
grant select,insert,delete on public.mycodex_shares to authenticated;

drop policy if exists "mycodex shares visible" on public.mycodex_shares;
create policy "mycodex shares visible" on public.mycodex_shares
for select to authenticated using (
 owner_user_id=(select auth.uid())
 or invited_email=lower((select auth.jwt())->>'email')
);
drop policy if exists "mycodex shares invite" on public.mycodex_shares;
create policy "mycodex shares invite" on public.mycodex_shares
for insert to authenticated with check (owner_user_id=(select auth.uid()));
drop policy if exists "mycodex shares revoke" on public.mycodex_shares;
create policy "mycodex shares revoke" on public.mycodex_shares
for delete to authenticated using (owner_user_id=(select auth.uid()));

-- A user may always work on their own collection, and an invited
-- user may also work on the collection owned by their inviter.
drop policy if exists "mycodex finds select own" on public.mycodex_finds;
create policy "mycodex finds select own" on public.mycodex_finds for select to authenticated
using (user_id=(select auth.uid()) or exists (
 select 1 from public.mycodex_shares s where s.owner_user_id=user_id
 and s.invited_email=lower((select auth.jwt())->>'email')
));
drop policy if exists "mycodex finds insert own" on public.mycodex_finds;
create policy "mycodex finds insert own" on public.mycodex_finds for insert to authenticated
with check (user_id=(select auth.uid()) or exists (
 select 1 from public.mycodex_shares s where s.owner_user_id=user_id
 and s.invited_email=lower((select auth.jwt())->>'email')
));
drop policy if exists "mycodex finds update own" on public.mycodex_finds;
create policy "mycodex finds update own" on public.mycodex_finds for update to authenticated
using (user_id=(select auth.uid()) or exists (
 select 1 from public.mycodex_shares s where s.owner_user_id=user_id
 and s.invited_email=lower((select auth.jwt())->>'email')
))
with check (user_id=(select auth.uid()) or exists (
 select 1 from public.mycodex_shares s where s.owner_user_id=user_id
 and s.invited_email=lower((select auth.jwt())->>'email')
));
drop policy if exists "mycodex finds delete own" on public.mycodex_finds;
create policy "mycodex finds delete own" on public.mycodex_finds for delete to authenticated
using (user_id=(select auth.uid()) or exists (
 select 1 from public.mycodex_shares s where s.owner_user_id=user_id
 and s.invited_email=lower((select auth.jwt())->>'email')
));

drop policy if exists "mycodex photos select own" on public.mycodex_photos;
create policy "mycodex photos select own" on public.mycodex_photos for select to authenticated
using (user_id=(select auth.uid()) or exists (
 select 1 from public.mycodex_shares s where s.owner_user_id=user_id
 and s.invited_email=lower((select auth.jwt())->>'email')
));
drop policy if exists "mycodex photos insert own" on public.mycodex_photos;
create policy "mycodex photos insert own" on public.mycodex_photos for insert to authenticated
with check (user_id=(select auth.uid()) or exists (
 select 1 from public.mycodex_shares s where s.owner_user_id=user_id
 and s.invited_email=lower((select auth.jwt())->>'email')
));
drop policy if exists "mycodex photos update own" on public.mycodex_photos;
create policy "mycodex photos update own" on public.mycodex_photos for update to authenticated
using (user_id=(select auth.uid()) or exists (
 select 1 from public.mycodex_shares s where s.owner_user_id=user_id
 and s.invited_email=lower((select auth.jwt())->>'email')
))
with check (user_id=(select auth.uid()) or exists (
 select 1 from public.mycodex_shares s where s.owner_user_id=user_id
 and s.invited_email=lower((select auth.jwt())->>'email')
));
drop policy if exists "mycodex photos delete own" on public.mycodex_photos;
create policy "mycodex photos delete own" on public.mycodex_photos for delete to authenticated
using (user_id=(select auth.uid()) or exists (
 select 1 from public.mycodex_shares s where s.owner_user_id=user_id
 and s.invited_email=lower((select auth.jwt())->>'email')
));

-- Photos are stored under <collection-owner-uuid>/<photo-uuid>.jpg .
drop policy if exists "mycodex storage read own" on storage.objects;
create policy "mycodex storage read own" on storage.objects for select to authenticated
using (bucket_id='mycodex-photos' and (
 (storage.foldername(name))[1]=(select auth.uid())::text
 or exists(select 1 from public.mycodex_shares s
 where s.owner_user_id::text=(storage.foldername(name))[1]
 and s.invited_email=lower((select auth.jwt())->>'email'))
));
drop policy if exists "mycodex storage upload own" on storage.objects;
create policy "mycodex storage upload own" on storage.objects for insert to authenticated
with check (bucket_id='mycodex-photos' and (
 (storage.foldername(name))[1]=(select auth.uid())::text
 or exists(select 1 from public.mycodex_shares s
 where s.owner_user_id::text=(storage.foldername(name))[1]
 and s.invited_email=lower((select auth.jwt())->>'email'))
));
drop policy if exists "mycodex storage delete own" on storage.objects;
create policy "mycodex storage delete own" on storage.objects for delete to authenticated
using (bucket_id='mycodex-photos' and (
 (storage.foldername(name))[1]=(select auth.uid())::text
 or exists(select 1 from public.mycodex_shares s
 where s.owner_user_id::text=(storage.foldername(name))[1]
 and s.invited_email=lower((select auth.jwt())->>'email'))
));
