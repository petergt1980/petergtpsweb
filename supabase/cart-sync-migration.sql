-- PeterGTPS cart sync: run in Supabase SQL Editor if cart tables are missing.
-- These policies restrict each user to their own cart. Do NOT make these tables public.
create table if not exists public.carts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);
create table if not exists public.cart_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  quantity integer not null default 1 check (quantity between 1 and 99),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
drop policy if exists "own cart only" on public.carts;
create policy "own cart only" on public.carts for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "own cart items only" on public.cart_items;
create policy "own cart items only" on public.cart_items for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
