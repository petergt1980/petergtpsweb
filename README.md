# PeterGTPS Store — Lua Script

Website statis untuk koleksi script Lua Growtopia dengan tema dark store modern.

## Deploy
1. Upload isi folder ini ke repository GitHub.
2. Aktifkan GitHub Pages dari branch `main` / root folder.
3. Buka website Pages setelah deploy selesai.

## Panel owner
- Login owner memakai password yang sudah dikonfigurasi di `assets/config.js`.
- Posting script, harga produk, dan pengaturan store disimpan langsung ke Supabase. Tombol publikasi tidak membutuhkan GitHub PAT.
- GitHub hanya diperlukan untuk menerbitkan perubahan kode website (HTML/CSS/JavaScript), bukan untuk mengubah katalog dan pengaturan toko.
- Tidak ada GitHub PAT yang diminta atau digunakan oleh tombol publikasi.
- Pengaturan store dapat mengubah nama, pemilik, tagline, warna aksen, dan logo; pengaturannya disimpan di Supabase.

## Catatan penyimpanan
Website ini tidak memakai `localStorage` atau `sessionStorage`. Sesi login, token, tema, dan rating sementara berada di memori halaman. Script dan branding yang dipublikasikan disimpan permanen di Supabase. Untuk autentikasi owner yang aman untuk website publik, gunakan backend; password hash pada website statis bukan pengganti autentikasi server.


## Fitur toko digital (tambahan)
- Keranjang belanja berada di menu navigasi **Keranjang**.
- Untuk menjual script: login owner → **Profil** → **Posting Script** atau buka script lalu **Edit script**. Isi harga dan centang **Tampilkan sebagai produk berbayar**.
- Klik **Publikasikan sekarang** agar katalog harga tersimpan ke tabel `public.products` di Supabase dan langsung terlihat oleh pengunjung.
- Keranjang akun yang login disinkronkan melalui Supabase; keranjang tamu hanya berada di memori halaman.
- Checkout saat ini membuat dan menyalin ringkasan pesanan; pembayaran, verifikasi, dan pengiriman file dilakukan manual oleh penjual. Ini bukan payment gateway otomatis.
- Gunakan hanya Supabase publishable/anon key pada frontend. Jangan pernah memasukkan Supabase service_role key ke website.
