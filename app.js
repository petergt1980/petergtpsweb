/* ============================================================
   PeterGTPS/lua-script — app logic
   - hash routing
   - owner-only posting (login dengan password)
   - search, tag filter, sort, star
   - Lua syntax highlight + copy + download
   ============================================================ */
(() => {
  'use strict';

  const CFG = Object.assign({
    owner: 'PeterGTPS',
    handle: '@PeterGTPS',
    siteName: 'PeterGTPS/lua-script',
    tagline: 'Script Lua Growtopia by @PeterGTPS',
    siteUrl: location.origin + location.pathname,
  }, window.PETER_CONFIG || {});

  /* ---------------- state (memory only; no browser storage) ---------------- */
  const readJSON = (_key, fallback) => fallback;
  const writeJSON = (_key, _value) => {};
  const LS_POSTS = 'memory.posts';
  const LS_STARS = 'memory.stars';
  const LS_THEME = 'memory.theme';
  const LS_AUTH = 'memory.auth';
  const LS_TOKEN = 'memory.token';
  const LS_HIDDEN = 'memory.hidden';

  const seed = Array.isArray(window.PETER_SEED_SCRIPTS) ? [...window.PETER_SEED_SCRIPTS] : [];
  let remoteSeed = seed;
  let userPosts = readJSON(LS_POSTS, []);
  let editingScriptId = null;
  let hiddenIds = new Set(readJSON(LS_HIDDEN, []));
  let starred = new Set(readJSON(LS_STARS, []));
  let isOwner = false;
  let cart = []; // keranjang sementara di memori halaman; tidak memakai localStorage

  /* Gabungkan script publik (dari repo) dengan postingan lokal.
     Kalau id-nya sama, versi lokal yang dipakai supaya owner langsung
     lihat hasil postingnya tanpa menunggu GitHub Pages selesai build. */
  const allScripts = () => {
    const map = new Map();
    remoteSeed.forEach((s) => map.set(s.id, s));
    userPosts.forEach((s) => map.set(s.id, s));
    return [...map.values()].filter((s) => !hiddenIds.has(s.id));
  };

  /* Script dianggap "sudah publik" kalau id-nya ada di data repo.
     Yang belum ada = belum dipublikasikan ke repository GitHub. */
  const isPublished = (script) => remoteSeed.some((s) => s.id === script.id);
  const unpublishedPosts = () => userPosts.filter((s) => !isPublished(s) && !hiddenIds.has(s.id));

  /* ---------------- dom ---------------- */
  const app = document.getElementById('app');
  const searchInput = document.getElementById('searchInput');
  const postModal = document.getElementById('postModal');
  const postForm = document.getElementById('postForm');
  const fileInput = document.getElementById('fileInput');
  const codeInput = document.getElementById('codeInput');
  const loginModal = document.getElementById('loginModal');
  const loginForm = document.getElementById('loginForm');
  const shareModal = document.getElementById('shareModal');
  const publishModal = document.getElementById('publishModal');
  const shareUrl = document.getElementById('shareUrl');
  const authArea = document.getElementById('authArea');
  const toastEl = document.getElementById('toast');
  const themeToggle = document.getElementById('themeToggle');

  /* ---------------- helpers ---------------- */
  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const formatDate = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  };

  const starCount = (script) => (Number(script.stars) || 0) + (starred.has(script.id) ? 1 : 0);

  /* Script dianggap "baru" kalau diposting dalam 7 hari terakhir.
     Dipakai buat penanda BARU di kartu, jadi pengunjung langsung ngeh. */
  const isNewScript = (script) => {
    const created = new Date(script.createdAt).getTime();
    if (Number.isNaN(created)) return false;
    return Date.now() - created < 7 * 24 * 60 * 60 * 1000;
  };

  const formatBytes = (code) => {
    const bytes = new Blob([code]).size;
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const lineCount = (code) => {
    if (!code) return 0;
    const n = code.split('\n').length;
    return code.endsWith('\n') ? n - 1 : n;
  };

  let toastTimer;
  const toast = (message) => {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  };

  const getScript = (id) => allScripts().find((s) => s.id === id);
  const money = (n) => Number(n) > 0 ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n)) : 'Gratis';
  const saleItems = () => allScripts().filter((s) => s.forSale && Number(s.price) > 0);
  const updateCartBadge = () => {
    const badge = document.getElementById('cartCount');
    if (badge) badge.textContent = String(cart.reduce((sum, item) => sum + item.qty, 0));
  };
  const syncCartToSupabase = async () => { try { if (window.PeterStoreDB?.client) { const {data:{user}} = await window.PeterStoreDB.client.auth.getUser(); if (user) await window.PeterStoreDB.setCart(cart); } } catch (e) { console.warn('Keranjang belum tersinkron:', e.message); } };

  const addToCart = (id) => {
    const product = getScript(id);
    if (!product || !product.forSale || Number(product.price) <= 0) return toast('Produk ini belum diaktifkan untuk dijual');
    const found = cart.find((item) => item.id === id);
    if (found) found.qty += 1; else cart.push({ id, qty: 1 });
    updateCartBadge(); toast(`${product.name} ditambahkan ke keranjang`);
  };
  const cartHTML = () => {
    const rows = cart.map((item) => {
      const product = getScript(item.id); if (!product) return '';
      return `<div class="cart-row"><div class="cart-product"><strong>${escapeHtml(product.name)}</strong><small>${money(product.price)} × ${item.qty}</small></div><div class="cart-controls"><button class="btn btn-ghost sm" data-cart-minus="${escapeHtml(item.id)}">−</button><span>${item.qty}</span><button class="btn btn-ghost sm" data-cart-plus="${escapeHtml(item.id)}">+</button><button class="btn btn-danger-soft sm" data-cart-remove="${escapeHtml(item.id)}">Hapus</button></div><strong>${money(Number(product.price) * item.qty)}</strong></div>`;
    }).join('');
    const total = cart.reduce((sum, item) => { const p = getScript(item.id); return sum + (p ? Number(p.price || 0) * item.qty : 0); }, 0);
    return `<section class="cart-page"><div class="page-head"><h1 class="page-title">Keranjang</h1><p class="page-sub">Review produk script Lua sebelum membuat pesanan.</p></div>${rows ? `<div class="panel cart-panel"><div class="panel-body">${rows}<div class="cart-total"><span>Total pesanan</span><strong>${money(total)}</strong></div><div class="row"><button class="btn btn-ghost" data-cart-clear>Kosongkan</button><button class="btn btn-primary" data-checkout>Buat pesanan</button></div><p class="form-hint">Checkout akan membuka WhatsApp admin dengan rincian pesanan. Kirim pesan tersebut untuk melanjutkan pembelian; pembayaran dan pengiriman dikonfirmasi manual oleh penjual.</p></div></div>` : `<div class="empty-state"><span class="big">🛒</span><h3>Keranjang masih kosong</h3><p>Pilih script berlabel Produk untuk mulai membuat pesanan.</p><a class="btn btn-primary" href="#/">Jelajahi produk</a></div>`}</section>`;
  };

  /* ---------------- theme ---------------- */
  const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.textContent = theme === 'dark' ? '☀' : '☾';
    themeToggle.title = theme === 'dark' ? 'Mode terang' : 'Mode gelap';
  };
  applyTheme('dark');
  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    writeJSON(LS_THEME, next);
  });

  /* ---------------- Lua highlighter ---------------- */
  const LUA_RE = /(--\[\[[\s\S]*?\]\]|--[^\n]*)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\[\[[\s\S]*?\]\])|(\b\d+(?:\.\d+)?\b)|(\b(?:local|function|end|if|then|else|elseif|for|while|do|return|break|nil|true|false|and|or|not|in|repeat|until)\b)/g;

  const highlightLines = (code) => {
    const lines = [[]];
    const push = (text, cls) => {
      if (!text) return;
      const parts = text.split('\n');
      parts.forEach((part, index) => {
        if (index > 0) lines.push([]);
        if (part) {
          lines[lines.length - 1].push(cls ? `<span class="${cls}">${escapeHtml(part)}</span>` : escapeHtml(part));
        }
      });
    };

    let last = 0;
    let match;
    LUA_RE.lastIndex = 0;
    while ((match = LUA_RE.exec(code)) !== null) {
      push(code.slice(last, match.index), null);
      if (match[1]) push(match[1], 'tok-com');
      else if (match[2]) push(match[2], 'tok-str');
      else if (match[3]) push(match[3], 'tok-num');
      else push(match[4], 'tok-kw');
      last = match.index + match[0].length;
    }
    push(code.slice(last), null);

    return lines.map((parts, i) =>
      `<span class="code-line"><span class="ln">${i + 1}</span>${parts.join('') || ' '}</span>`
    ).join('');
  };

  /* ---------------- clipboard & download ---------------- */
  const copyText = async (text, successMessage) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(successMessage || 'Kode berhasil dicopy');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        toast(successMessage || 'Kode berhasil dicopy');
      } catch {
        toast('Gagal copy, coba manual ya');
      }
      ta.remove();
    }
  };

  const downloadFile = (filename, content, mime = 'text/plain;charset=utf-8') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadScript = (script) => {
    downloadFile(script.filename || `${script.name}.lua`, script.code);
    toast('File script sedang diunduh ♥');
  };

  /* ---------------- state ---------------- */
  const state = { query: '', tag: 'all', sort: 'featured' };

  /* ---------------- auth UI ---------------- */
  const renderAuthArea = () => {
    updateCartBadge();
    if (isOwner) {
      authArea.innerHTML = `
        <span class="owner-chip" title="Kamu login sebagai owner">
          <span class="mini-avatar">PG</span> ${escapeHtml(CFG.owner)}
          <button type="button" data-logout>keluar</button>
        </span>
        <button class="btn btn-primary" id="newPostBtn"><span class="plus">+</span> Posting Script</button>`;
    } else {
      authArea.innerHTML = `
        <button class="btn btn-ghost" data-login>Login owner</button>`;
    }
  };

  const openModal = (modal) => {
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  };
  const closeModal = (modal) => {
    modal.hidden = true;
    document.body.style.overflow = '';
  };
  const closeAllModals = () => {
    [postModal, loginModal, shareModal, publishModal].forEach((m) => { if (m) m.hidden = true; });
    document.body.style.overflow = '';
  };

  const requireOwner = (action) => {
    if (isOwner) {
      action();
      return;
    }
    openModal(loginModal);
    setTimeout(() => loginForm.querySelector('[name="password"]')?.focus(), 60);
  };

  /* ---------------- components ---------------- */
  const ownerPostButton = (label = '+ Posting Script') => isOwner
    ? `<button class="btn btn-primary" data-open-post>${label}</button>`
    : `<button class="btn btn-primary" data-login>${label}</button>`;

  const heroHTML = () => {
    const total = allScripts().length;
    const totalStars = allScripts().reduce((sum, s) => sum + starCount(s), 0);
    const totalLines = allScripts().reduce((sum, s) => sum + (s.lines || lineCount(s.code)), 0);
    return `
      <section class="hero">
        <div class="hero-cover"></div>
        <div class="hero-body">
          <div class="hero-top">
            <div>
              <div class="hero-avatar" aria-hidden="true"><img src="assets/petergtps.png" alt="PeterGTPS"></div>
              <h1 class="hero-name">${escapeHtml(CFG.owner)} <span class="badge">✓ VERIFIED</span></h1>
              <div class="hero-handle">${escapeHtml(CFG.handle)} · LUA SCRIPT STORE</div>
              <p class="hero-bio">
                Hai! Aku ${escapeHtml(CFG.owner)} ♡ aku nulis script <strong>Lua untuk Growtopia private server</strong> —
                rapi, aman, dan pastinya aesthetic. Semua script bisa langsung kamu copy atau download.
              </p>
            </div>
            <div class="hero-cta">
              ${ownerPostButton()}
              <a class="btn btn-ghost" href="#/profile">Lihat Profil</a>
            </div>
          </div>
          <div class="hero-stats">
            <span class="stat-pill"><span class="dot">◆</span><strong>${total}</strong> script</span>
            <span class="stat-pill"><span class="dot">★</span><strong>${totalStars}</strong> stars</span>
            <span class="stat-pill"><span class="dot">≡</span><strong>${totalLines.toLocaleString('id-ID')}</strong> baris kode</span>
            <span class="stat-pill"><span class="dot">↗</span>Script collection</span>
          </div>
        </div>
      </section>`;
  };

  const cardHTML = (script) => {
    const isStarred = starred.has(script.id);
    const tags = (script.tags || []).slice(0, 4)
      .map((t) => `<span class="tag">#${escapeHtml(t)}</span>`).join('');
    return `
      <article class="repo-card${script.featured ? ' featured' : ''}" data-open-script="${escapeHtml(script.id)}" tabindex="0" role="link" aria-label="Buka ${escapeHtml(script.name)}">
        <div class="repo-head">
          <div class="repo-icon">${script.featured ? '★' : '⌘'}</div>
          <div style="min-width:0">
            <h3 class="repo-name">${escapeHtml(script.name)} ${isNewScript(script) ? '<span class="badge new">BARU</span>' : ''}${isOwner && script.mine && !isPublished(script) ? ' <span class="badge draft">belum publik</span>' : ''}</h3>
            <span class="repo-file">${escapeHtml(script.filename || 'script.lua')}</span>
          </div>
        </div>
        <p class="repo-desc">${escapeHtml(script.description || 'Tanpa deskripsi.')}</p>
        ${script.forSale && Number(script.price) > 0 ? `<div class="product-price"><span class="product-label">DIGITAL SCRIPT</span><strong>${money(script.price)}</strong></div><button class="btn btn-primary sm add-cart-btn" data-add-cart="${escapeHtml(script.id)}">🛒 Tambah ke keranjang</button>` : ''}
        <div class="repo-tags">${tags || '<span class="tag">#lua</span>'}</div>
        <div class="repo-foot">
          <span class="meta"><span class="lang-dot"></span>Lua</span>
          <span class="meta">★ ${starCount(script)}</span>
          <span class="meta">${(script.forSale && Number(script.price) > 0 ? (script.lines || 0) : (script.lines || lineCount(script.code))).toLocaleString('id-ID')} baris</span>
          <button class="star-btn${isStarred ? ' starred' : ''}" data-star="${escapeHtml(script.id)}" title="Beri bintang" aria-pressed="${isStarred}">
            <span class="star-glyph">${isStarred ? '★' : '☆'}</span> ${isStarred ? 'Starred' : 'Star'}
          </button>
        </div>
      </article>`;
  };

  const filteredScripts = () => {
    const q = state.query.trim().toLowerCase();
    const list = allScripts().filter((s) => {
      if (state.tag !== 'all' && !(s.tags || []).includes(state.tag)) return false;
      if (!q) return true;
      const haystack = [s.name, s.filename, s.description, (s.tags || []).join(' '), s.code]
        .join(' ').toLowerCase();
      return haystack.includes(q);
    });

    const sorters = {
      featured: (a, b) => (Number(b.featured) - Number(a.featured)) || (new Date(b.createdAt) - new Date(a.createdAt)),
      newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      stars: (a, b) => starCount(b) - starCount(a),
      name: (a, b) => a.name.localeCompare(b.name, 'id'),
    };
    return list.sort(sorters[state.sort] || sorters.featured);
  };

  const tagList = () => {
    const set = new Set();
    allScripts().forEach((s) => (s.tags || []).forEach((t) => set.add(t)));
    return [...set].sort();
  };

  const emptyHTML = (title, text) => `
    <div class="empty-state">
      <span class="big">🌷</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
      ${ownerPostButton()}
    </div>`;

  const partnersHTML = () => {
    const links = Array.isArray(CFG.partners) ? CFG.partners.filter((p) => p && /^https:\/\//i.test(String(p.url || ''))) : [];
    return `<section class="partners-section panel"><div class="panel-body"><span class="eyebrow">COMMUNITY</span><h2 class="page-title" style="font-size:22px">Partner & Links</h2><p class="page-sub">Temukan komunitas dan kanal resmi yang terhubung dengan PeterGTPS.</p><div class="partner-grid">${links.length ? links.map((p) => `<a class="partner-card" href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer"><span class="partner-mark">↗</span><span><strong>${escapeHtml(p.name || 'Partner')}</strong><small>${escapeHtml(p.label || 'Kunjungi link')}</small></span><span class="partner-arrow">↗</span></a>`).join('') : '<p class="form-hint">Belum ada link partner. Tambahkan URL di assets/config.js.</p>'}</div></div></section>`;
  };

  const homeHTML = () => {
    const list = filteredScripts();
    const tags = tagList();
    const chips = [`<button class="chip${state.tag === 'all' ? ' active' : ''}" data-tag="all">Semua</button>`]
      .concat(tags.map((t) => `<button class="chip${state.tag === t ? ' active' : ''}" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</button>`))
      .join('');

    const grid = list.length
      ? `<div class="repo-grid">${list.map(cardHTML).join('')}</div>`
      : emptyHTML('Belum ada script yang cocok', 'Coba kata kunci lain, atau lihat semua script.');

    return `
      ${heroHTML()}
      <section class="shop-strip"><div><span class="eyebrow">PETERGTPS DIGITAL STORE</span><h2>Script pilihan, siap dipesan.</h2><p>Temukan script gratis dan produk digital berbayar dari katalog.</p></div><a class="btn btn-primary" href="#/cart">🛒 Lihat keranjang <span id="cartCountInline">${cart.reduce((n,x)=>n+x.qty,0)}</span></a></section>
      ${saleItems().length ? `<div class="page-head" style="margin:24px 0 14px"><h2 class="page-title" style="font-size:22px">Produk untuk dijual</h2><p class="page-sub">${saleItems().length} produk digital</p></div><div class="repo-grid">${saleItems().map(cardHTML).join('')}</div>` : ''}
      <div class="page-head" style="margin:24px 0 14px"><h2 class="page-title" style="font-size:22px">Katalog Gratis</h2><p class="page-sub">Script gratis bisa dibuka, dibaca, dicopy, dan diunduh tanpa checkout.</p></div>
      <div class="repo-grid">${list.filter(s => !(s.forSale && Number(s.price) > 0)).map(cardHTML).join('') || '<p class="form-hint">Belum ada script gratis di katalog.</p>'}</div>
      <div class="page-head" style="margin-bottom:14px">
        <h2 class="page-title" style="font-size:22px">Semua Script</h2>
        <p class="page-sub">${list.length} script ditemukan${state.query ? ` untuk “${escapeHtml(state.query)}”` : ''}</p>
      </div>
      <div class="toolbar">
        <div class="chips">${chips}</div>
        <div class="toolbar-spacer"></div>
        <div class="select-wrap">
          <select id="sortSelect" aria-label="Urutkan">
            <option value="featured"${state.sort === 'featured' ? ' selected' : ''}>Unggulan</option>
            <option value="newest"${state.sort === 'newest' ? ' selected' : ''}>Terbaru</option>
            <option value="stars"${state.sort === 'stars' ? ' selected' : ''}>Paling banyak ★</option>
            <option value="name"${state.sort === 'name' ? ' selected' : ''}>Nama A–Z</option>
          </select>
        </div>
      </div>
      ${grid}
      ${partnersHTML()}`;
  };

  const profileHTML = () => {
    const list = filteredScripts();
    const total = allScripts().length;
    const totalStars = allScripts().reduce((sum, s) => sum + starCount(s), 0);
    const mine = allScripts().filter((s) => s.mine).length;
    const pending = unpublishedPosts().length;
    return `
      <section class="hero">
        <div class="hero-cover"></div>
        <div class="hero-body">
          <div class="hero-avatar" aria-hidden="true"><img src="assets/petergtps.png" alt="PeterGTPS"></div>
          <h1 class="hero-name">${escapeHtml(CFG.owner)} <span class="badge lilac">SCRIPT DEVELOPER</span></h1>
          <div class="hero-handle">${escapeHtml(CFG.handle)}</div>
          <p class="hero-bio">
            Developer script Lua untuk Growtopia private server. Fokus pada script praktis, kode yang rapi, dan fitur yang berguna.
          </p>
          <div class="hero-stats">
            <span class="stat-pill"><strong>${total}</strong> script publik</span>
            <span class="stat-pill"><strong>${totalStars}</strong> total stars</span>
            <span class="stat-pill"><strong>${mine}</strong> postingan lokal</span>
            <span class="stat-pill">Bergabung Okt 2026</span>
          </div>
          <div class="hero-cta">
            ${ownerPostButton()}
            <a class="btn btn-ghost" href="#/">Jelajahi Script</a>
          </div>
        </div>
      </section>

      ${isOwner ? `
        <div class="owner-panel">
          <h3>👑 Owner panel</h3>
          <p>Kamu login sebagai admin. Script, harga produk, dan pengaturan toko tersimpan di Supabase sehingga bisa dilihat semua pengunjung tanpa GitHub PAT.</p>
          ${pending ? `<p class="publish-warn">⚠️ <strong>${pending} postingan belum publik</strong> — belum tersimpan di database. Klik <strong>Publikasikan sekarang</strong> supaya terlihat di perangkat lain.</p>` : ''}
          <div class="admin-metrics">
            <div class="admin-metric"><span>Total script</span><strong>${total}</strong></div>
            <div class="admin-metric"><span>Total stars</span><strong>${totalStars}</strong></div>
            <div class="admin-metric"><span>Draft lokal</span><strong>${pending}</strong></div>
            <div class="admin-metric"><span>Disembunyikan</span><strong>${hiddenIds.size}</strong></div>
            <div class="admin-metric"><span>Produk dijual</span><strong>${saleItems().length}</strong></div>
          </div>
          <div class="admin-sales-help"><strong>🛍️ Kelola produk toko</strong><p>Untuk menjual script, klik Posting Script atau Edit script, isi harga, centang “Tampilkan sebagai produk berbayar”, lalu publikasikan ke Supabase. Produk baru langsung muncul di toko.</p></div>
          <div class="row">
            <button class="btn btn-primary sm" data-open-post>+ Tambah script / produk</button>
            <button class="btn btn-ghost sm" data-publish>↻ Publikasikan sekarang</button>
            <button class="btn btn-ghost sm" data-export>⬇ Export manual</button>
            <button class="btn btn-soft sm" data-backup>⤓ Backup admin</button>
            <button class="btn btn-ghost sm" data-open-settings>⚙ Pengaturan Store</button>
          </div>
        </div>` : `
        <div class="owner-panel">
          <h3>🔒 Area owner</h3>
          <p>Hanya owner yang bisa memposting script. Pengunjung bisa melihat, copy, download, dan memberi ★.</p>
          <div class="row"><button class="btn btn-soft sm" data-login>Login sebagai owner</button></div>
        </div>`}

      ${isOwner ? `
        <section class="store-settings panel" id="storeSettings">
          <div class="panel-head">⚙ Pengaturan Store</div>
          <div class="panel-body">
            <p class="page-sub" style="margin-bottom:14px">Ubah logo, nama store, tagline, dan warna aksen. Pengaturan disimpan ke Supabase agar berlaku untuk semua pengunjung.</p>
            <div class="form-row two">
              <label><span>Nama website</span><input id="settingSiteName" maxlength="80" value="${escapeHtml(CFG.siteName)}"></label>
              <label><span>Nama pemilik</span><input id="settingOwner" maxlength="60" value="${escapeHtml(CFG.owner)}"></label>
            </div>
            <label><span>Tagline store</span><input id="settingTagline" maxlength="160" value="${escapeHtml(CFG.tagline)}"></label>
            <div class="form-row two">
              <label><span>Warna aksen</span><input id="settingAccent" type="color" value="#ef3340"></label>
              <label><span>Ganti logo (PNG, JPG, WebP)</span><input id="settingLogo" type="file" accept="image/png,image/jpeg,image/webp"></label>
            </div>
            <label><span>Partner & link (satu baris per partner: Nama | Label | URL https://...)</span><textarea id="settingPartners" rows="5" placeholder="Discord | Komunitas | https://discord.gg/INVITE
YouTube | Tutorial | https://youtube.com/@channel">${escapeHtml((CFG.partners || []).map(p => `${p.name || ''} | ${p.label || ''} | ${p.url || ''}`).join('\n'))}</textarea></label>
            <div class="row"><button class="btn btn-primary sm" data-save-settings>Simpan pengaturan</button></div>
            <p class="form-hint">Pengaturan disimpan ke Supabase; kolom partners_json perlu ditambahkan dengan SQL migrasi di folder supabase.</p>
          </div>
        </section>` : ''}

      <div class="about-grid" style="margin-bottom:22px">
        <div class="feature">
          <div class="ico">💗</div>
          <h3>Spesialisasi</h3>
          <p>Automation world, panel dialog, role &amp; permission, dan utilitas server.</p>
        </div>
        <div class="feature">
          <div class="ico">🧁</div>
          <h3>Gaya kode</h3>
          <p>pcall di mana-mana, komentar jelas, dan performa batch biar server tetap ringan.</p>
        </div>
        <div class="feature">
          <div class="ico">🌸</div>
          <h3>Lisensi</h3>
          <p>Bebas dipakai dan dimodifikasi untuk kebutuhan server kamu. Jangan dijual ulang ya.</p>
        </div>
      </div>

      <div class="page-head" style="margin-bottom:14px">
        <h2 class="page-title" style="font-size:22px">Postingan Script</h2>
        <p class="page-sub">${list.length} script · script dalam koleksi</p>
      </div>
      ${list.length
        ? `<div class="repo-grid">${list.map(cardHTML).join('')}</div>`
        : emptyHTML('Belum ada postingan', 'Yuk mulai posting script Lua pertamamu.')}`;
  };

  const aboutHTML = () => `
    <div class="page-head">
      <h1 class="page-title">Tentang ${escapeHtml(CFG.siteName)}</h1>
      <p class="page-sub">Store digital untuk koleksi script Lua Growtopia private server.</p>
    </div>

    <div class="about-grid" style="margin-bottom:18px">
      <div class="feature">
        <div class="ico">📜</div>
        <h3>Koleksi Script</h3>
        <p>Semua script ditampilkan lengkap dengan nomor baris, highlight Lua, tombol copy, dan download.</p>
      </div>
      <div class="feature">
        <div class="ico">✍️</div>
        <h3>Posting Khusus Owner</h3>
        <p>Hanya ${escapeHtml(CFG.handle)} yang bisa memposting. Pengunjung cukup lihat, copy, download, dan kasih ★.</p>
      </div>
      <div class="feature">
        <div class="ico">🔍</div>
        <h3>Pencarian Cepat</h3>
        <p>Cari berdasarkan nama, deskripsi, tag, bahkan isi kodenya. Tekan <kbd>/</kbd> untuk langsung fokus.</p>
      </div>
      <div class="feature">
        <div class="ico">🌙</div>
        <h3>Mode Gelap</h3>
        <p>Mata capek? Ganti ke tema gelap pink lewat tombol tema di kanan atas.</p>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">Cara pakai script</div>
      <div class="panel-body">
        <div class="steps">
          <div class="step"><div><h4>Pilih script</h4><p>Buka salah satu kartu script di halaman beranda.</p></div></div>
          <div class="step"><div><h4>Copy atau download</h4><p>Gunakan tombol <strong>Copy</strong> atau <strong>Download .lua</strong> di bagian atas kode.</p></div></div>
          <div class="step"><div><h4>Pasang di server</h4><p>Letakkan file di folder <code>scripts/</code> server Growtopia private server kamu, lalu restart / reload.</p></div></div>
          <div class="step"><div><h4>Test dulu</h4><p>Coba di server lokal sebelum dipakai di server utama. Selalu backup data.</p></div></div>
        </div>
        <div class="notice" style="margin-top:16px">
          <span>⚠️</span>
          <span>Script di sini dibuat untuk Growtopia private server. Gunakan dengan tanggung jawab sendiri dan hormati aturan komunitasmu.</span>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">Credits</div>
      <div class="panel-body">
        <p><strong>Author:</strong> ${escapeHtml(CFG.handle)}</p>
        <p><strong>Website:</strong> ${escapeHtml(CFG.siteName)}</p>
        <p><strong>Bahasa:</strong> Lua 5.1</p>
        <p><strong>Target:</strong> Growtopia Private Server (GTPS)</p>
      </div>
    </div>`;

  const detailHTML = (script) => {
    if (!script) {
      return `<div class="empty-state">
        <span class="big">🥀</span>
        <h3>Script tidak ditemukan</h3>
        <p>Mungkin sudah dihapus atau link-nya salah.</p>
        <a class="btn btn-primary" href="#/">Kembali ke beranda</a>
      </div>`;
    }

    const isStarred = starred.has(script.id);
    const tags = (script.tags || []).map((t) => `<span class="tag">#${escapeHtml(t)}</span>`).join('');
    const isPaidProduct = Boolean(script.forSale && Number(script.price) > 0);
    const code = script.code || '';
    const showCode = !isPaidProduct || isOwner || script.unlocked === true;

    return `
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="#/">Beranda</a>
        <span class="sep">/</span>
        <a href="#/profile">${escapeHtml(CFG.handle)}</a>
        <span class="sep">/</span>
        <span>${escapeHtml(script.name)}</span>
      </nav>

      <div class="detail-head">
        <div>
          <h1>${escapeHtml(script.name)} ${script.featured ? '<span class="badge">✦ unggulan</span>' : ''}${isNewScript(script) ? ' <span class="badge new">BARU</span>' : ''}${isOwner && script.mine && !isPublished(script) ? ' <span class="badge draft">belum publik</span>' : ''}</h1>
          <div class="repo-tags" style="margin-top:8px">${tags}</div>
        </div>
        <div class="detail-actions">
          ${showCode ? `<button class="btn btn-soft sm" data-copy="${escapeHtml(script.id)}">⧉ Copy</button><button class="btn btn-ghost sm" data-download="${escapeHtml(script.id)}">↓ Download .lua</button>` : `<span class="badge">🔒 Kode terkunci</span>`}
          <button class="btn ${isStarred ? 'btn-primary' : 'btn-ghost'} sm" data-star="${escapeHtml(script.id)}">
            ${isStarred ? '★ Starred' : '☆ Star'} · ${starCount(script)}
          </button>
          ${isOwner ? `<button class="btn btn-ghost sm" data-edit-script="${escapeHtml(script.id)}">Edit script</button>` : ''}${isOwner ? `<button class="btn btn-danger-soft sm" data-delete="${escapeHtml(script.id)}">Hapus</button>` : ''}
        </div>
      </div>

      ${showCode ? `<div class="panel">
        <div class="panel-head">
          <span class="file-name">📄 ${escapeHtml(script.filename || 'script.lua')}</span>
          <span class="badge mint">Lua</span>
          <div class="right"><button class="btn btn-soft sm" data-copy="${escapeHtml(script.id)}">Copy kode</button></div>
        </div>
        <div class="code-wrap"><pre><code>${highlightLines(code)}</code></pre></div>
        <div class="code-note"><span>${(script.lines || lineCount(code)).toLocaleString('id-ID')} baris</span><span>·</span><span>${formatBytes(code)}</span><span>·</span><span>Diperbarui ${formatDate(script.updatedAt || script.createdAt)}</span><span>·</span><span>Script by ${escapeHtml(CFG.handle)}</span></div>
      </div>` : `<div class="panel locked-product-panel"><div class="panel-body"><div class="locked-icon">🔒</div><h2>Script berbayar — kode disembunyikan</h2><p>Kode Lua tidak ditampilkan sebelum pesanan kamu dibayar dan akses diberikan oleh admin.</p><p class="form-hint">Setelah checkout, hubungi admin untuk konfirmasi pembayaran. Unduhan tersedia setelah pesanan ditandai lunas/selesai.</p><button class="btn btn-ghost" data-download-purchased="${escapeHtml(script.id)}">Cek akses & download</button></div></div>`}

      ${script.forSale && Number(script.price) > 0 ? `<div class="panel product-detail-buy"><div class="panel-body"><span class="product-label">PRODUK DIGITAL</span><h2>${money(script.price)}</h2><p>${escapeHtml(script.description || 'Script Lua digital dari PeterGTPS Store.')}</p><button class="btn btn-primary" data-add-cart="${escapeHtml(script.id)}">🛒 Tambah ke keranjang</button></div></div>` : ''}
      <div class="panel">
        <div class="panel-head">Deskripsi</div>
        <div class="panel-body">
          <p>${escapeHtml(script.description || 'Belum ada deskripsi untuk script ini.')}</p>
          <div class="meta-grid" style="margin-top:14px">
            <div class="meta-box"><div class="k">Author</div><div class="v">${escapeHtml(CFG.handle)}</div></div>
            <div class="meta-box"><div class="k">Bahasa</div><div class="v">Lua 5.1</div></div>
            <div class="meta-box"><div class="k">Dibuat</div><div class="v">${formatDate(script.createdAt)}</div></div>
            <div class="meta-box"><div class="k">Stars</div><div class="v">★ ${starCount(script)}</div></div>
          </div>
        </div>
      </div>

      <div class="notice">
        <span>💡</span>
        <span>Selalu test script di server lokal dulu, dan backup world/data sebelum memasang script baru.</span>
      </div>`;
  };

  /* ---------------- router ---------------- */
  const parseRoute = () => {
    const hash = location.hash.replace(/^#/, '') || '/';
    const parts = hash.split('/').filter(Boolean);
    if (parts[0] === 'script' && parts[1]) return { name: 'script', id: decodeURIComponent(parts[1]) };
    if (parts[0] === 'profile') return { name: 'profile' };
    if (parts[0] === 'about') return { name: 'about' };
    if (parts[0] === 'cart') return { name: 'cart' };
    return { name: 'home' };
  };

  const setActiveNav = (name) => {
    document.querySelectorAll('[data-nav]').forEach((link) => {
      link.classList.toggle('active', link.dataset.nav === name);
    });
  };

  const render = () => {
    const route = parseRoute();
    let html = '';

    if (route.name === 'script') html = detailHTML(getScript(route.id));
    else if (route.name === 'profile') html = profileHTML();
    else if (route.name === 'about') html = aboutHTML();
    else if (route.name === 'cart') html = cartHTML();
    else html = homeHTML();

    app.innerHTML = html;
    setActiveNav(route.name === 'script' ? 'home' : route.name);
    updateCartBadge();
    renderAuthArea();
    window.scrollTo(0, 0);
  };

  window.addEventListener('hashchange', render);

  /* ---------------- delegated events ---------------- */
  app.addEventListener('click', async (event) => {
    const addCartBtn = event.target.closest('[data-add-cart]');
    if (addCartBtn) { event.preventDefault(); event.stopPropagation(); addToCart(addCartBtn.dataset.addCart); return; }
    const plus = event.target.closest('[data-cart-plus]'); if (plus) { const x=cart.find(i=>i.id===plus.dataset.cartPlus); if(x)x.qty++; syncCartToSupabase(); render(); return; }
    const minus = event.target.closest('[data-cart-minus]'); if (minus) { const x=cart.find(i=>i.id===minus.dataset.cartMinus); if(x)x.qty--; cart=cart.filter(i=>i.qty>0); syncCartToSupabase(); render(); return; }
    const remove = event.target.closest('[data-cart-remove]'); if (remove) { cart=cart.filter(i=>i.id!==remove.dataset.cartRemove); syncCartToSupabase(); render(); return; }
    if (event.target.closest('[data-cart-clear]')) { cart=[]; syncCartToSupabase(); render(); return; }
    if (event.target.closest('[data-checkout]')) {
      const checkoutBtn = event.target.closest('[data-checkout]');
      try {
        if (!cart.length) throw new Error('Keranjang masih kosong.');
        const customerName = window.prompt('Nama pemesan:');
        if (!customerName || !customerName.trim()) throw new Error('Nama pemesan wajib diisi.');

        const lines = cart.map((item) => {
          const product = getScript(item.id);
          if (!product) throw new Error('Salah satu produk tidak ditemukan. Muat ulang halaman dan coba lagi.');
          return `• ${product.title || product.name || product.id} x${item.qty} — ${money(Number(product.price || 0) * item.qty)}`;
        });
        const total = cart.reduce((sum, item) => {
          const product = getScript(item.id);
          return sum + (product ? Number(product.price || 0) * item.qty : 0);
        }, 0);
        const message = [
          'Halo PeterGTPS, saya ingin checkout script Lua:',
          '',
          `Nama: ${customerName.trim()}`,
          ...lines,
          '',
          `Total: ${money(total)}`,
          '',
          'Mohon info pembayaran dan proses pengiriman. Terima kasih.'
        ].join('\\n');
        const url = `https://wa.me/6285604788705?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
        toast('WhatsApp dibuka. Tekan Kirim di WhatsApp untuk mengirim pesanan.');
      } catch (error) {
        toast(`Checkout gagal: ${error.message}`);
      }
      return;
    }
    const tagBtn = event.target.closest('[data-tag]');
    if (tagBtn) {
      state.tag = tagBtn.dataset.tag;
      render();
      return;
    }

    const purchasedDownload = event.target.closest('[data-download-purchased]');
    if (purchasedDownload) {
      const originalText = purchasedDownload.textContent;
      purchasedDownload.disabled = true; purchasedDownload.textContent = 'Memeriksa akses…';
      try {
        const file = await window.PeterStoreDB.getProductCode(purchasedDownload.dataset.downloadPurchased);
        const product = getScript(purchasedDownload.dataset.downloadPurchased);
        downloadFile(file.filename || product?.filename || 'script.lua', file.code);
        toast('Akses tersedia — script berhasil diunduh.');
      } catch (error) { toast(error.message || 'Akses belum tersedia.'); }
      finally { purchasedDownload.disabled = false; purchasedDownload.textContent = originalText; }
      return;
    }

    const starBtn = event.target.closest('[data-star]');
    if (starBtn) {
      event.stopPropagation();
      const id = starBtn.dataset.star;
      const wasStarred = starred.has(id);
      if (wasStarred) starred.delete(id);
      else starred.add(id);
      writeJSON(LS_STARS, [...starred]);
      toast(wasStarred ? 'Bintang dilepas 🥺' : 'Terima kasih atas ratingnya!');
      render();
      return;
    }

    const copyBtn = event.target.closest('[data-copy]');
    if (copyBtn) {
      const script = getScript(copyBtn.dataset.copy);
      if (script && (!(script.forSale && Number(script.price) > 0) || isOwner || script.unlocked === true)) copyText(script.code); else toast('Kode script berbayar terkunci sampai pesanan dikonfirmasi.');
      return;
    }

    const downloadBtn = event.target.closest('[data-download]');
    if (downloadBtn) {
      const script = getScript(downloadBtn.dataset.download);
      if (script && (!(script.forSale && Number(script.price) > 0) || isOwner || script.unlocked === true)) downloadScript(script); else toast('Kode script berbayar terkunci sampai pesanan dikonfirmasi.');
      return;
    }

    const editBtn = event.target.closest('[data-edit-script]');
    if (editBtn) {
      if (!isOwner) { openModal(loginModal); return; }
      const script = getScript(editBtn.dataset.editScript);
      if (!script) return;
      editingScriptId = script.id;
      postForm.querySelector('[name="name"]').value = script.name || '';
      postForm.querySelector('[name="filename"]').value = script.filename || 'script.lua';
      postForm.querySelector('[name="description"]').value = script.description || '';
      postForm.querySelector('[name="tags"]').value = (script.tags || []).join(', ');
      postForm.querySelector('[name="price"]').value = Number(script.price || 0);
      postForm.querySelector('[name="forSale"]').checked = Boolean(script.forSale && Number(script.price) > 0);
      codeInput.value = script.code || '';
      document.getElementById('postTitle').textContent = 'Edit Script';
      const submit = postForm.querySelector('[type="submit"]');
      if (submit) submit.textContent = 'Simpan Perubahan';
      openModal(postModal);
      return;
    }

    const deleteBtn = event.target.closest('[data-delete]');
    if (deleteBtn) {
      const id = deleteBtn.dataset.delete;
      const script = getScript(id);
      if (!script) return;
      if (!window.confirm(`Hapus postingan "${script.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
      userPosts = userPosts.filter((s) => s.id !== id);
      writeJSON(LS_POSTS, userPosts);
      // Kalau script ini sudah ada di repo, sembunyikan dari daftar publik.
      if (remoteSeed.some((s) => s.id === id)) {
        hiddenIds.add(id);
        writeJSON(LS_HIDDEN, [...hiddenIds]);
      }
      try {
        if (window.PeterStoreDB?.ready) await window.PeterStoreDB.deleteProduct(id);
        toast('Postingan dihapus dari toko');
        location.hash = '#/profile';
        if (window.PeterStoreDB?.ready) await refreshProductsFromSupabase(); else render();
      } catch (error) { toast(`Gagal menghapus dari Supabase: ${error.message}`); }
      return;
    }

    if (event.target.closest('[data-export]')) {
      requireOwner(() => exportScriptsData());
      return;
    }

    if (event.target.closest('[data-backup]')) {
      if (!isOwner) { openModal(loginModal); return; }
      const backup = {
        exportedAt: new Date().toISOString(),
        posts: userPosts,
        hiddenIds: [...hiddenIds],
        starredIds: [...starred],
        theme: readJSON(LS_THEME, 'light'),
      };
      downloadFile(`peter-admin-backup-${new Date().toISOString().slice(0,10)}.json`,
        JSON.stringify(backup, null, 2), 'application/json;charset=utf-8');
      toast('Backup admin berhasil dibuat');
      return;
    }

    if (event.target.closest('[data-publish]')) {
      requireOwner(() => runPublish({ silent: false }));
      return;
    }

    if (event.target.closest('[data-open-post]')) {
      requireOwner(() => {
        editingScriptId = null;
        postForm.reset();
        document.getElementById('postTitle').textContent = 'Posting Script Baru';
        const submitBtn = postForm.querySelector('[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Publikasikan';
        openModal(postModal);
      });
      return;
    }

    const openScript = event.target.closest('[data-open-script]');
    if (openScript) {
      location.hash = `#/script/${encodeURIComponent(openScript.dataset.openScript)}`;
    }
  });

  app.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      const card = event.target.closest('[data-open-script]');
      if (card) {
        event.preventDefault();
        location.hash = `#/script/${encodeURIComponent(card.dataset.openScript)}`;
      }
    }
  });

  app.addEventListener('change', (event) => {
    if (event.target.id === 'sortSelect') {
      state.sort = event.target.value;
      render();
    }
  });

  /* ---------------- search ---------------- */
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = searchInput.value;
      if (parseRoute().name !== 'home') location.hash = '#/';
      else render();
    }, 140);
  });

  document.addEventListener('keydown', (event) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    if (event.key === '/' && !typing) {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    if (event.key === 'Escape') closeAllModals();
  });

  /* ---------------- topbar auth actions ---------------- */
  authArea.addEventListener('click', (event) => {
    if (event.target.closest('[data-login]')) {
      openModal(loginModal);
      setTimeout(() => loginForm.querySelector('[name="password"]')?.focus(), 60);
      return;
    }
    if (event.target.closest('[data-logout]')) {
      window.PeterStoreDB?.signOut().catch((error) => console.warn('Logout:', error.message));
      isOwner = false;
      writeJSON(LS_AUTH, false);
      toast('Kamu sudah keluar dari mode owner');
      render();
      return;
    }
    if (event.target.closest('#newPostBtn')) {
      requireOwner(() => openModal(postModal));
    }
  });

  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target.closest('[data-close-modal]')) closeModal(modal);
    });
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');
    try {
      if (!window.PeterStoreDB?.ready) throw new Error('Isi URL dan publishable/anon key Supabase di assets/supabase-config.js terlebih dahulu.');
      await window.PeterStoreDB.signIn(email, password);
      const admin = await window.PeterStoreDB.isAdmin();
      if (!admin) { await window.PeterStoreDB.signOut(); throw new Error('Akun ini belum diberi role admin di tabel user_roles.'); }
      isOwner = true;
      loginForm.reset(); closeModal(loginModal);
      toast(`Selamat datang, ${CFG.owner}!`); render();
    } catch (err) { toast(err?.message || 'Login Supabase gagal.'); }
  });

  // Restore verified admin session and hydrate the account-specific cart.
  (async () => {
    try {
      if (!window.PeterStoreDB?.ready) return;
      isOwner = await window.PeterStoreDB.isAdmin();
      const savedCart = await window.PeterStoreDB.getCart();
      if (savedCart.length) cart = savedCart;
      render();
    } catch (err) { console.warn('Supabase session/cart:', err.message); }
  })();

  /* ---------------- post form ---------------- */
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast('File terlalu besar (maks 2 MB)');
      fileInput.value = '';
      return;
    }
    const text = await file.text();
    codeInput.value = text;
    const nameField = postForm.querySelector('[name="name"]');
    const fileField = postForm.querySelector('[name="filename"]');
    if (!fileField.value) fileField.value = file.name;
    if (!nameField.value) nameField.value = file.name.replace(/\.lua$/i, '').replace(/[-_]+/g, ' ');
    toast('File berhasil dimuat');
  });

  postForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isOwner) {
      closeModal(postModal);
      openModal(loginModal);
      toast('Login owner dulu untuk memposting');
      return;
    }

    const data = new FormData(postForm);
    const code = String(data.get('code') || '').trim();
    if (!code) {
      codeInput.focus();
      codeInput.style.borderColor = '#ff8fa3';
      toast('Isi kode script dulu.');
      return;
    }

    const now = new Date().toISOString();
    const name = String(data.get('name') || '').trim();
    const rawFilename = String(data.get('filename') || '').trim();
    const filename = rawFilename || `${(name || 'script').toLowerCase().replace(/\s+/g, '-')}.lua`;
    const tags = String(data.get('tags') || '')
      .split(',')
      .map((t) => t.trim().toLowerCase().replace(/^#/, ''))
      .filter(Boolean)
      .slice(0, 6);

    const existing = editingScriptId ? getScript(editingScriptId) : null;
    const post = {
      id: existing ? existing.id : `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: name || 'Script Tanpa Nama',
      filename: filename.endsWith('.lua') ? filename : `${filename}.lua`,
      description: String(data.get('description') || '').trim(),
      price: Math.max(0, Number(data.get('price') || 0)),
      forSale: data.get('forSale') === 'on' && Number(data.get('price') || 0) > 0,
      tags: tags.length ? tags : ['lua'],
      code,
      lines: lineCount(code),
      stars: existing ? (Number(existing.stars) || 0) : 0,
      createdAt: existing ? (existing.createdAt || now) : now,
      updatedAt: now,
      mine: existing ? Boolean(existing.mine) : true,
      featured: existing ? Boolean(existing.featured) : false,
    };

    if (existing) {
      const remoteIndex = remoteSeed.findIndex((s) => s.id === existing.id);
      const localIndex = userPosts.findIndex((s) => s.id === existing.id);
      if (remoteIndex >= 0) remoteSeed[remoteIndex] = { ...remoteSeed[remoteIndex], ...post, mine: remoteSeed[remoteIndex].mine || false };
      else if (localIndex >= 0) userPosts[localIndex] = { ...userPosts[localIndex], ...post };
      else userPosts.unshift(post);
    } else {
      userPosts.unshift(post);
    }
    editingScriptId = null;
    writeJSON(LS_POSTS, userPosts);
    postForm.reset();
    document.getElementById('postTitle').textContent = 'Posting Script Baru';
    const submitBtn = postForm.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Publikasikan';
    codeInput.style.borderColor = '';
    closeModal(postModal);
    toast('Script berhasil dipublikasikan!');
    location.hash = `#/script/${encodeURIComponent(post.id)}`;
    render();

    // Simpan langsung ke database Supabase; tidak membutuhkan GitHub PAT.
    try {
      await window.PeterStoreDB.upsertProduct(post);
      toast('Script tersimpan dan langsung dipublikasikan ke toko!');
      await refreshProductsFromSupabase();
    } catch (error) {
      toast(`Gagal menyimpan ke Supabase: ${error.message}`);
    }
  });

  /* ---------------- publikasi ke Supabase (tanpa GitHub PAT) ---------------- */
  const buildPayload = () => {
    const map = new Map();
    remoteSeed.forEach((s) => map.set(s.id, s));
    userPosts.forEach((s) => map.set(s.id, s));
    return [...map.values()].filter((s) => !hiddenIds.has(s.id));
  };

  const runPublish = async ({ silent } = {}) => {
    if (!isOwner) { if (!silent) openModal(loginModal); return false; }
    const button = document.getElementById('publishNow') || document.querySelector('[data-publish]');
    const label = button?.textContent || '';
    if (button) { button.disabled = true; button.textContent = 'Mempublikasikan…'; }
    try {
      if (!window.PeterStoreDB?.ready) throw new Error('Supabase belum dikonfigurasi.');
      const payload = buildPayload();
      await window.PeterStoreDB.publishProducts(payload);
      await refreshProductsFromSupabase();
      toast(`Berhasil dipublikasikan ke toko! ${payload.length} script tersedia untuk pengunjung.`);
      return true;
    } catch (error) {
      toast(`Gagal publikasi: ${error.message}`);
      return false;
    } finally {
      if (button) { button.disabled = false; button.textContent = label || 'Publikasikan'; }
    }
  };

  /* ---------------- export manual (cadangan) ---------------- */
  function exportScriptsData() {
    const payload = buildPayload();
    const file = `window.PETER_SEED_SCRIPTS = ${JSON.stringify(payload, null, 2)};\n`;
    downloadFile('scripts-data.js', file, 'text/javascript;charset=utf-8');
    toast('scripts-data.js diunduh — commit manual ke repo ♥');
  }

  /* ---------------- share ---------------- */
  const shareUrlValue = () => (CFG.siteUrl || (location.origin + location.pathname)).replace(/\/?$/, '/');

  const openShare = () => {
    shareUrl.value = shareUrlValue();
    openModal(shareModal);
  };

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-share]')) {
      event.preventDefault();
      openShare();
    }
  });

  document.getElementById('shareCopy')?.addEventListener('click', () => {
    copyText(shareUrl.value, 'Link website berhasil dicopy');
  });

  document.getElementById('shareWa')?.addEventListener('click', () => {
    const text = `${CFG.siteName} — ${CFG.tagline}\n${shareUrl.value}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  });

  /* ---------------- tombol publikasi: Supabase, tanpa token ---------------- */
  document.getElementById('publishNow')?.addEventListener('click', async () => {
    const ok = await runPublish({ silent: false });
    if (ok) closeModal(publishModal);
  });

  /* ---------------- pengaturan store tersimpan di Supabase ---------------- */
  const setLogoEverywhere = (src) => {
    if (!src) return;
    document.querySelectorAll('.brand-logo, .hero-avatar img').forEach((img) => { img.src = src; });
    const icon = document.querySelector('link[rel="icon"]');
    if (icon) icon.href = src;
    const absoluteLogo = src.startsWith('data:') ? src : new URL(src, location.href).href;
    document.querySelectorAll('meta[property="og:image"], meta[property="og:image:secure_url"], meta[name="twitter:image"]').forEach((meta) => { meta.content = absoluteLogo; });
  };

  const applyStoreSettings = (settings) => {
    if (!settings) return;
    if (settings.site_name || settings.siteName) CFG.siteName = settings.site_name || settings.siteName;
    if (settings.owner_name || settings.owner) CFG.owner = settings.owner_name || settings.owner;
    if (settings.tagline) CFG.tagline = settings.tagline;
    if (settings.partners_json) { try { CFG.partners = typeof settings.partners_json === 'string' ? JSON.parse(settings.partners_json) : settings.partners_json; } catch (_) {} }
    const accent = settings.accent;
    if (accent) ['--pink-400','--pink-500','--pink-600'].forEach((name) => document.documentElement.style.setProperty(name, accent));
    const logo = settings.logo_url || settings.logo;
    if (logo) setLogoEverywhere(logo);
    const title = document.querySelector('title');
    if (title) title.textContent = `${CFG.siteName} · Lua Script Store`;
  };

  const loadStoreSettings = async () => {
    try {
      if (window.PeterStoreDB?.ready) {
        const settings = await window.PeterStoreDB.getSettings();
        if (settings) applyStoreSettings(settings);
      } else {
        const response = await fetch(`assets/site-settings.json?v=${Date.now()}`, { cache: 'no-store' });
        if (response.ok) applyStoreSettings(await response.json());
      }
      renderAuthArea(); render();
    } catch (error) { console.warn('Pengaturan store Supabase:', error.message); }
  };

  const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca file logo'));
    reader.readAsDataURL(file);
  });

  const saveStoreSettings = async () => {
    if (!isOwner) return;
    const button = document.querySelector('[data-save-settings]');
    if (button) { button.disabled = true; button.textContent = 'Menyimpan…'; }
    try {
      if (!window.PeterStoreDB?.ready) throw new Error('Supabase belum dikonfigurasi.');
      const settings = {
        site_name: document.getElementById('settingSiteName')?.value.trim() || CFG.siteName,
        owner_name: document.getElementById('settingOwner')?.value.trim() || CFG.owner,
        tagline: document.getElementById('settingTagline')?.value.trim() || CFG.tagline,
        partners_json: (document.getElementById('settingPartners')?.value || '').split(/\r?\n/).map(line => { const [name='', label='', url=''] = line.split('|').map(v => v.trim()); return {name, label, url}; }).filter(p => p.name && /^https:\/\//i.test(p.url)),
        accent: document.getElementById('settingAccent')?.value || '#ef3340',
        logo_url: 'assets/petergtps.png',
      };
      const logoFile = document.getElementById('settingLogo')?.files?.[0];
      if (logoFile) {
        if (!logoFile.type.startsWith('image/')) throw new Error('Pilih file gambar yang valid.');
        if (logoFile.size > 300 * 1024) throw new Error('Logo maksimal 300 KB agar aman disimpan di pengaturan.');
        settings.logo_url = await readFileAsDataURL(logoFile);
      }
      await window.PeterStoreDB.saveSettings(settings);
      applyStoreSettings(settings);
      toast('Pengaturan store tersimpan ke Supabase dan langsung berlaku untuk semua pengunjung.');
      renderAuthArea(); render();
    } catch (error) {
      toast(`Gagal menyimpan: ${error.message}`);
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Simpan pengaturan'; }
    }
  };

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-open-settings]')) {
      document.getElementById('storeSettings')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (event.target.closest('[data-save-settings]')) saveStoreSettings();
  });

  /* ---------------- ambil data publik terbaru (cache-buster) ---------------- */
  const refreshFromServer = async () => {
    try {
      const res = await fetch(`assets/scripts-data.js?v=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const text = await res.text();
      const start = text.indexOf('[');
      const end = text.lastIndexOf(']');
      if (start === -1 || end === -1) return;
      const list = JSON.parse(text.slice(start, end + 1));
      if (!Array.isArray(list)) return;
      remoteSeed = list;
      render();
    } catch { /* offline / file:// → pakai data bawaan */ }
  };

  /* Pengunjung yang sudah buka halaman tetap dapat script baru:
     cek ulang tiap 60 detik + saat tab dibuka kembali. */
  const startAutoRefresh = () => {
    setInterval(() => {
      if (document.visibilityState === 'visible' && !document.hidden) { if (window.PeterStoreDB?.ready) refreshProductsFromSupabase().catch(() => {}); else refreshFromServer(); }
    }, 60000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') { if (window.PeterStoreDB?.ready) refreshProductsFromSupabase().catch(() => {}); else refreshFromServer(); }
    });
  };

  const fromDbProduct = (row) => ({
    id: row.id, name: row.name, filename: row.filename, description: row.description || '',
    tags: row.tags || [], code: row.code || '', price: Number(row.price || 0),
    forSale: Boolean(row.for_sale), published: row.published !== false,
    lines: lineCount(row.code || ''), stars: Number(row.stars || 0),
    createdAt: row.created_at || new Date().toISOString(), updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
    mine: true, featured: Boolean(row.featured),
  });

  const refreshProductsFromSupabase = async () => {
    if (!window.PeterStoreDB?.ready) return;
    const rows = await window.PeterStoreDB.getProductsForCatalog();
    if (rows.length) remoteSeed = rows.map(fromDbProduct);
    userPosts = []; 
    hiddenIds = new Set();
    render();
  };

  /* ---------------- init ---------------- */
  renderAuthArea();
  render();
  if (window.PeterStoreDB?.ready) refreshProductsFromSupabase().catch((error) => console.warn('Produk Supabase:', error.message));
  else refreshFromServer();
  loadStoreSettings();
  startAutoRefresh();
})();
