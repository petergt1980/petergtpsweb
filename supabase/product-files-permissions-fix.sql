-- PeterGTPS Store: perbaiki permission product_files tanpa membuka source ke publik.
-- Jalankan di Supabase Dashboard > SQL Editor menggunakan role postgres.
-- Pembeli harus login dan order berstatus paid/fulfilled; admin bisa mengelola semua source.

alter table public.product_files enable row level security;
revoke all on table public.product_files from anon, public;
grant select, insert, update, delete on table public.product_files to authenticated;

drop policy if exists "admin manage product files" on public.product_files;
create policy "admin manage product files"
on public.product_files for all to authenticated
using (public.is_store_admin())
with check (public.is_store_admin());

drop policy if exists "buyers read purchased product files" on public.product_files;
create policy "buyers read purchased product files"
on public.product_files for select to authenticated
using (
  public.is_store_admin()
  or exists (
    select 1
    from public.orders o
    where o.user_id = (select auth.uid())
      and o.status in ('paid', 'fulfilled')
      and o.items @> jsonb_build_array(jsonb_build_object('product_id', product_files.product_id))
  )
);

-- Jangan membuat policy SELECT untuk anon/public: itu akan membocorkan source script berbayar.
