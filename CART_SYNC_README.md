# Perbaikan sinkronisasi keranjang

1. Jalankan `supabase/cart-sync-migration.sql` di Supabase SQL Editor. Jika tabel dan policy sudah ada di `schema.sql`, file ini aman dijalankan ulang.
2. Deploy folder website ke Netlify.
3. Pastikan `assets/supabase-config.js` berisi URL dan publishable/anon key proyek Supabase yang benar.
4. Buat akun pelanggan di Supabase Authentication (atau gunakan akun yang sudah ada). Form login website dapat dipakai oleh pelanggan; hanya akun ber-role `admin` yang mendapat akses admin.
5. Login dengan email/password yang sama di PC dan HP. Tambah produk di satu perangkat; keranjang disimpan ke `cart_items` dan dimuat saat login di perangkat lain.

Keranjang guest yang belum pernah disimpan ke akun tidak otomatis pindah perangkat. Jangan memberi akses `anon` ke tabel cart. Uji setelah deploy; jika muncul error RLS, cek policy dan project Supabase yang digunakan.
