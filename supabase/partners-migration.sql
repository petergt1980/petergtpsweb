-- Jalankan di Supabase SQL Editor untuk mengaktifkan pengelolaan partner dari admin panel.
alter table public.store_settings add column if not exists partners_json jsonb not null default '[]'::jsonb;
