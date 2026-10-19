/* ============================================================
   Konfigurasi website — edit bagian ini saja
   ============================================================ */
window.PETER_CONFIG = {
  // Nama yang tampil sebagai "pemilik" website
  owner: 'PeterGTPS',
  handle: '@PeterGTPS',

  // Nama website / repo (tampil di title & preview WhatsApp)
  siteName: 'PeterGTPS/lua-script',
  tagline: 'Script Lua Growtopia by @PeterGTPS',

  /* Alamat website setelah di-hosting.
     Kosongkan ('') = otomatis pakai alamat yang sedang dibuka.
     Diisi = tombol "Bagikan ke WhatsApp" selalu memakai link ini,
     walau dibuka dari localhost / preview. */
  siteUrl: 'https://petergt1980.github.io/petergtpsweb/',

  /* Repo GitHub untuk publikasi otomatis.
     Setiap kali owner memposting script, website menulis ulang
     assets/scripts-data.js di repo ini lewat GitHub API. GitHub Pages
     lalu rebuild, jadi SEMUA pengunjung langsung melihat script barunya.
     Token GitHub TIDAK disimpan di file ini (lihat modal publikasi). */
  repo: {
    owner: 'petergt1980',
    name: 'petergtpsweb',
    branch: 'main',
    dataPath: 'assets/scripts-data.js',
  },

  /* Hash password owner. Ini hanya menyamarkan password plaintext:
     autentikasi di website statis tetap bisa dibongkar/ditiru oleh pengunjung.
     Untuk keamanan nyata, pindahkan login ke backend/server. */
  ownerPasswordHash: '2628669465',
};
