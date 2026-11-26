create extension if not exists pgcrypto;

create table if not exists public.categories (
  name text primary key check (char_length(name) between 1 and 60)
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  category text not null references public.categories (name),
  year text not null check (char_length(year) between 1 and 30),
  price text not null check (char_length(price) between 1 and 40),
  image text not null,
  description text not null default '' check (char_length(description) <= 1000),
  engine text not null default '' check (char_length(engine) <= 80),
  power text not null default '' check (char_length(power) <= 50),
  torque text not null default '' check (char_length(torque) <= 50),
  acceleration text not null default '' check (char_length(acceleration) <= 50),
  top_speed text not null default '' check (char_length(top_speed) <= 50),
  transmission text not null default '' check (char_length(transmission) <= 80),
  drivetrain text not null default '' check (char_length(drivetrain) <= 50),
  weight text not null default '' check (char_length(weight) <= 50),
  region text not null default '' check (char_length(region) <= 80),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null
);

create index if not exists cars_status_created_at_idx on public.cars (status, created_at desc);
create index if not exists cars_owner_id_created_at_idx on public.cars (owner_id, created_at desc);

alter table public.categories enable row level security;
alter table public.admin_users enable row level security;
alter table public.cars enable row level security;

revoke all on public.admin_users from anon, authenticated;
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant select on public.cars to anon, authenticated;
grant insert, update, delete on public.cars to authenticated;

drop policy if exists "Anyone can read categories" on public.categories;
create policy "Anyone can read categories"
on public.categories for select
to anon, authenticated
using (true);

drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories"
on public.categories for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Anyone can read approved cars" on public.cars;
create policy "Anyone can read approved cars"
on public.cars for select
to anon
using (status = 'approved');

drop policy if exists "Users read approved, owned, or admin-visible cars" on public.cars;
create policy "Users read approved, owned, or admin-visible cars"
on public.cars for select
to authenticated
using (
  status = 'approved'
  or (select auth.uid()) = owner_id
  or (select public.is_admin())
);

drop policy if exists "Users submit pending cars" on public.cars;
create policy "Users submit pending cars"
on public.cars for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  and status = 'pending'
  and reviewed_at is null
  and reviewed_by is null
);

drop policy if exists "Admins insert cars" on public.cars;
create policy "Admins insert cars"
on public.cars for insert
to authenticated
with check ((select public.is_admin()));

drop policy if exists "Admins update cars" on public.cars;
create policy "Admins update cars"
on public.cars for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "Admins delete cars" on public.cars;
create policy "Admins delete cars"
on public.cars for delete
to authenticated
using ((select public.is_admin()));

insert into public.categories (name) values
  ('Supercar'), ('Hypercar'), ('Track'), ('JDM Legend'), ('90s Supercar'), ('80s/90s Icon')
on conflict (name) do nothing;

insert into public.cars
  (id, name, category, year, price, image, description, engine, power, torque, acceleration, top_speed, transmission, drivetrain, weight, region, status)
values
  ('00000000-0000-4000-8000-000000000001', 'McLaren F1', '90s Supercar', '1992–1998', '$20,000,000', 'https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?w=600&q=80', 'The undisputed king of the 90s.', '6.1L V12', '618 hp', '651 Nm', '3.2 s', '386 km/h', '6-speed manual', 'RWD', '1,140 kg', 'Europe (UK)', 'approved'),
  ('00000000-0000-4000-8000-000000000002', 'Nissan Skyline R34', 'JDM Legend', '1999–2002', '$250,000', 'https://images.unsplash.com/photo-1627454836700-9c5c0c1b1f3d?w=600&q=80', 'Godzilla. The legendary RB26DETT engine.', '2.6L I6', '280 hp', '392 Nm', '4.5 s', '250 km/h', '6-speed manual', 'AWD', '1,560 kg', 'Asia (Japan)', 'approved'),
  ('00000000-0000-4000-8000-000000000003', 'Ferrari F40', '80s/90s Icon', '1987–1992', '$3,500,000', 'https://images.unsplash.com/photo-1592198084033-aade902d1aae?w=600&q=80', 'The last car Enzo Ferrari approved.', '2.9L V8', '471 hp', '577 Nm', '3.8 s', '324 km/h', '5-speed manual', 'RWD', '1,369 kg', 'Europe (Italy)', 'approved'),
  ('00000000-0000-4000-8000-000000000004', 'Porsche 911 GT3 RS', 'Track', '2022–Present', '$240,000', 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&q=80', 'The ultimate track-focused 911 with DRS.', '4.0L Flat-6', '518 hp', '465 Nm', '3.0 s', '296 km/h', '7-speed PDK', 'RWD', '1,450 kg', 'Europe (Germany)', 'approved'),
  ('00000000-0000-4000-8000-000000000005', 'Bugatti Veyron', 'Hypercar', '2005–2015', '$2,000,000', 'https://images.unsplash.com/photo-1626668893632-6f3a4466d22f?w=600&q=80', 'The car that broke the 400 km/h barrier.', '8.0L W16', '1001 hp', '1250 Nm', '2.5 s', '407 km/h', '7-speed DSG', 'AWD', '1,888 kg', 'Europe (France)', 'approved'),
  ('00000000-0000-4000-8000-000000000006', 'Toyota Supra MK4', 'JDM Legend', '1993–2002', '$120,000', 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=600&q=80', 'Famous for its bulletproof 2JZ-GTE engine.', '3.0L I6', '320 hp', '440 Nm', '4.6 s', '285 km/h', '6-speed manual', 'RWD', '1,510 kg', 'Asia (Japan)', 'approved')
on conflict do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('car-images', 'car-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view car photos" on storage.objects;
create policy "Anyone can view car photos"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'car-images');

drop policy if exists "Users upload photos to their own folder" on storage.objects;
create policy "Users upload photos to their own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'car-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users remove photos from their own folder" on storage.objects;
create policy "Users remove photos from their own folder"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'car-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
