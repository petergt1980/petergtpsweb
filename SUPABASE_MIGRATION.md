# PeterGTPS Store — Supabase setup

Website ini memakai Supabase untuk publikasi katalog dan pengaturan toko. Tombol **Publikasikan sekarang** dan **Simpan pengaturan** tidak membutuhkan GitHub PAT.

## 1. Konfigurasi Supabase
1. Buka https://supabase.com/dashboard dan pilih project kamu.
2. Jalankan `supabase/schema.sql` melalui SQL Editor (kalau tabel sudah ada, SQL menggunakan pola aman `if not exists` dan mengganti policies terkait).
3. Pastikan `assets/supabase-config.js` berisi Project URL dan publishable/anon key yang benar.
4. Jangan pernah memakai `service_role` atau secret key di browser.

## 2. Admin
1. Supabase → Authentication → Users → Add user, buat akun email/password.
2. Salin UUID akun itu.
3. Jalankan di SQL Editor, ganti UUID contoh:
   ```sql
   insert into public.user_roles(user_id, role)
   values ('YOUR-UUID', 'admin')
   on conflict (user_id) do update set role = 'admin';
   ```
4. Login melalui tombol Login owner di website.

## 3. Publikasi langsung
- Login admin, lalu pilih **Profil → Publikasikan sekarang** untuk menyimpan katalog script dan harga ke `public.products`.
- Gunakan **Pengaturan Store → Simpan pengaturan** untuk menyimpan nama, pemilik, tagline, aksen, dan logo ke `public.store_settings`.
- Pengunjung mengambil katalog dan pengaturan dari Supabase; perubahan konten tidak menunggu deploy GitHub Pages.
- Perubahan kode website (HTML/CSS/JavaScript) masih memerlukan commit/deploy hosting seperti biasa. PAT tidak digunakan oleh fitur publikasi konten toko.

## Catatan
- Checkout saat ini hanya menyalin ringkasan pesanan; tidak ada payment gateway otomatis.
- Isi file Lua tidak diubah dalam patch ini.
