-- PeterGTPS Store: private guest cart sync via secret 256-bit token in shared URL.
-- Run this entire file in Supabase SQL Editor. Do NOT expose service_role keys in frontend.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.guest_carts (
  token_hash text primary key,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_carts_items_array check (jsonb_typeof(items) = 'array')
);

alter table public.guest_carts enable row level security;
revoke all on table public.guest_carts from anon, authenticated, public;

create or replace function public.guest_cart_load(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare result jsonb;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid cart token';
  end if;
  select items into result from public.guest_carts
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  return jsonb_build_object('items', result);
end;
$$;

create or replace function public.guest_cart_save(p_token text, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare normalized jsonb;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid cart token';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'Invalid cart items';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) as e(item)
    where coalesce(e.item->>'id','') = ''
       or length(e.item->>'id') > 200
       or coalesce((e.item->>'qty')::integer, 0) < 1
       or coalesce((e.item->>'qty')::integer, 0) > 99
  ) then
    raise exception 'Invalid cart item';
  end if;
  -- Keep only the supported fields; do not store client-supplied price or code.
  select coalesce(jsonb_agg(jsonb_build_object('id', item->>'id', 'qty', (item->>'qty')::integer)), '[]'::jsonb)
    into normalized from jsonb_array_elements(p_items) as e(item);
  insert into public.guest_carts(token_hash, items, updated_at)
  values (encode(extensions.digest(p_token, 'sha256'), 'hex'), normalized, now())
  on conflict (token_hash) do update set items = excluded.items, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.guest_cart_load(text) from public;
revoke all on function public.guest_cart_save(text, jsonb) from public;
grant execute on function public.guest_cart_load(text) to anon, authenticated;
grant execute on function public.guest_cart_save(text, jsonb) to anon, authenticated;
