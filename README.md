# PeterGTPS Store — Lua Script

Website statis untuk koleksi script Lua Growtopia dengan tema dark store modern.

## Deploy
1. Upload isi folder ini ke repository GitHub.
2. Aktifkan GitHub Pages dari branch `main` / root folder.
3. Buka website Pages setelah deploy selesai.

## Panel owner
- Login owner memakai password yang sudah dikonfigurasi di `assets/config.js`.
- Posting script dan perubahan store dipublikasikan melalui GitHub Contents API.
- Saat diminta, masukkan fine-grained GitHub token dengan akses **Contents: Read and write** hanya ke repository `petergtpsweb`.
- Token hanya disimpan di memori halaman dan tidak ditulis ke localStorage, file, atau repository. Refresh halaman akan meminta token kembali.
- Pengaturan store dapat mengubah nama, pemilik, tagline, warna aksen, dan logo. Logo harus PNG dan ditulis ke `assets/petergtps.png`.

## Catatan penyimpanan
Website ini tidak memakai `localStorage` atau `sessionStorage`. Sesi login, token, tema, dan rating sementara berada di memori halaman. Script dan branding yang dipublikasikan disimpan permanen di repository GitHub. Untuk autentikasi owner yang aman untuk website publik, gunakan backend; password hash pada website statis bukan pengganti autentikasi server.


## Fitur toko digital (tambahan)
- Keranjang belanja berada di menu navigasi **Keranjang**.
- Untuk menjual script: login owner → **Profil** → **Posting Script** atau buka script lalu **Edit script**. Isi harga dan centang **Tampilkan sebagai produk berbayar**.
- Klik **Publikasikan sekarang** agar katalog harga ikut tersimpan ke `assets/scripts-data.js` di GitHub. Produk baru terlihat oleh pengunjung setelah GitHub Pages selesai deploy.
- Keranjang sengaja hanya disimpan di memori halaman (tidak memakai localStorage/sessionStorage), jadi akan kosong jika halaman di-refresh.
- Checkout saat ini membuat dan menyalin ringkasan pesanan; pembayaran, verifikasi, dan pengiriman file dilakukan manual oleh penjual. Ini bukan payment gateway otomatis.
- Karena website ini statis, jangan masukkan token GitHub yang memiliki akses ke repository lain. Gunakan fine-grained token dengan akses minimum ke repository website ini saja.
