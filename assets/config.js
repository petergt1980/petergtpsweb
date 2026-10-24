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

  // Link partner/sosial yang tampil di bagian Partner & Links.
  // Ganti URL contoh atau tambahkan link milik partner kamu.
  partners: [
    { name: 'GitHub', label: 'Website source', url: 'https://github.com/petergt1980/petergtpsweb' },
    { name: 'WhatsApp', label: 'Kontak / order', url: 'https://wa.me/085604788705' }
  ],
  // Notifikasi WhatsApp dikirim melalui Supabase Edge Function.
  // Nomor/token WhatsApp disimpan sebagai Supabase Secrets, bukan di file ini.

};
