-- PeterGTPS Store Supabase schema
-- Run in Supabase Dashboard > SQL Editor. Then create an Auth user and assign admin role below.
create extension if not exists pgcrypto;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);
create table if not exists public.store_settings (
  id boolean primary key default true check (id),
  site_name text not null default 'PeterGTPS STORE',
  owner_name text not null default 'PeterGTPS',
  tagline text not null default 'Script Lua Growtopia by @PeterGTPS',
  accent text not null default '#ef3340',
  logo_url text,
  updated_at timestamptz not null default now()
);
insert into public.store_settings(id) values(true) on conflict(id) do nothing;

create table if not exists public.products (
  id text primary key,
  name text not null,
  filename text not null,
  description text not null default '',
  tags text[] not null default '{}',
  code text not null default '',
  price numeric(12,2) not null default 0 check(price >= 0),
  for_sale boolean not null default false,
  published boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.carts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);
create table if not exists public.cart_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check(quantity between 1 and 99),
  updated_at timestamptz not null default now(),
  primary key(user_id, product_id)
);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'pending' check(status in ('pending','paid','fulfilled','cancelled')),
  items jsonb not null default '[]'::jsonb,
  total numeric(12,2) not null default 0 check(total >= 0),
  customer_note text not null default '',
  created_at timestamptz not null default now()
);

create or replace function public.is_store_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin');
$$;
revoke all on function public.is_store_admin() from public;
grant execute on function public.is_store_admin() to anon, authenticated;

alter table public.user_roles enable row level security;
alter table public.store_settings enable row level security;
alter table public.products enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;

drop policy if exists "users read own role" on public.user_roles;
create policy "users read own role" on public.user_roles for select to authenticated using(user_id = (select auth.uid()));
drop policy if exists "admin manage roles" on public.user_roles;
create policy "admin manage roles" on public.user_roles for all to authenticated using(public.is_store_admin()) with check(public.is_store_admin());
drop policy if exists "public read store settings" on public.store_settings;
create policy "public read store settings" on public.store_settings for select to anon, authenticated using(true);
drop policy if exists "admin update store settings" on public.store_settings;
create policy "admin update store settings" on public.store_settings for update to authenticated using(public.is_store_admin()) with check(public.is_store_admin());
drop policy if exists "public read published products" on public.products;
create policy "public read published products" on public.products for select to anon, authenticated using(published = true or public.is_store_admin());
drop policy if exists "admin manage products" on public.products;
create policy "admin manage products" on public.products for all to authenticated using(public.is_store_admin()) with check(public.is_store_admin());
drop policy if exists "own cart only" on public.carts;
create policy "own cart only" on public.carts for all to authenticated using(user_id = (select auth.uid())) with check(user_id = (select auth.uid()));
drop policy if exists "own cart items only" on public.cart_items;
create policy "own cart items only" on public.cart_items for all to authenticated using(user_id = (select auth.uid())) with check(user_id = (select auth.uid()));
drop policy if exists "own orders read" on public.orders;
create policy "own orders read" on public.orders for select to authenticated using(user_id = (select auth.uid()) or public.is_store_admin());
drop policy if exists "own orders create" on public.orders;
create policy "own orders create" on public.orders for insert to authenticated with check(user_id = (select auth.uid()));
drop policy if exists "admin update orders" on public.orders;
create policy "admin update orders" on public.orders for update to authenticated using(public.is_store_admin()) with check(public.is_store_admin());

-- After creating your account in Authentication > Users, run this with its real UUID:
-- insert into public.user_roles(user_id, role) values ('YOUR-AUTH-USER-UUID', 'admin')
-- on conflict(user_id) do update set role='admin';
