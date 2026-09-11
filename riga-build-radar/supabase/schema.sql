create extension if not exists pgcrypto;

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  distance_m double precision not null default 0,
  duration_s integer not null default 0,
  point_count integer not null default 0,
  path jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.objects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  lat double precision not null,
  lng double precision not null,
  address text,
  object_type text,
  stage text,
  status text not null default 'Jauns',
  facade text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.object_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  object_id uuid not null references public.objects(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.trips enable row level security;
alter table public.objects enable row level security;
alter table public.object_photos enable row level security;

drop policy if exists "trips own rows" on public.trips;
create policy "trips own rows" on public.trips for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists "objects own rows" on public.objects;
create policy "objects own rows" on public.objects for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists "photos own rows" on public.object_photos;
create policy "photos own rows" on public.object_photos for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);

grant select,insert,update,delete on public.trips to authenticated;
grant select,insert,update,delete on public.objects to authenticated;
grant select,insert,update,delete on public.object_photos to authenticated;

insert into storage.buckets (id,name,public) values ('object-photos','object-photos',false)
on conflict (id) do update set public=false;

drop policy if exists "object photo read own" on storage.objects;
create policy "object photo read own" on storage.objects for select to authenticated using (bucket_id='object-photos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "object photo insert own" on storage.objects;
create policy "object photo insert own" on storage.objects for insert to authenticated with check (bucket_id='object-photos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "object photo delete own" on storage.objects;
create policy "object photo delete own" on storage.objects for delete to authenticated using (bucket_id='object-photos' and (storage.foldername(name))[1]=auth.uid()::text);
