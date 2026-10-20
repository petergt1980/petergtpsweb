(() => {
  const cfg = window.PETER_SUPABASE_CONFIG || {};
  const ready = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cfg.url || '') && !!cfg.anonKey && !String(cfg.anonKey).includes('YOUR_');
  const client = ready && window.supabase ? window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
  const fail = (error) => { if (error) throw error; };
  const toRow = (s, userId) => ({
    id: String(s.id), name: String(s.name || 'Script tanpa nama'), filename: String(s.filename || 'script.lua'),
    description: String(s.description || ''), tags: Array.isArray(s.tags) ? s.tags : [], code: String(s.code || ''),
    price: Math.max(0, Number(s.price) || 0), for_sale: Boolean(s.forSale && Number(s.price) > 0),
    published: true, stars: Math.max(0, Number(s.stars) || 0), featured: Boolean(s.featured), created_by: userId || null, created_at: s.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  window.PeterStoreDB = {
    ready, client,
    async signIn(email, password) { if (!client) throw new Error('Konfigurasi Supabase belum diisi.'); const {data,error}=await client.auth.signInWithPassword({email,password}); fail(error); return data; },
    async signOut() { if(client) { const {error}=await client.auth.signOut(); fail(error); } },
    async isAdmin() { if(!client) return false; const {data:{user}}=await client.auth.getUser(); if(!user) return false; const {data,error}=await client.from('user_roles').select('role').eq('user_id',user.id).maybeSingle(); fail(error); return data?.role === 'admin'; },
    async getProducts() { if(!client) return []; const {data,error}=await client.from('products').select('*').eq('published',true).order('created_at',{ascending:false}); fail(error); return data||[]; },
    async getProductsForCatalog() { if(!client) return []; const admin=await this.isAdmin(); let query=client.from('products').select('*').order('created_at',{ascending:false}); if(!admin) query=query.eq('published',true); const {data,error}=await query; fail(error); return data||[]; },
    async getSettings() { if(!client) return null; const {data,error}=await client.from('store_settings').select('*').eq('id',true).maybeSingle(); fail(error); return data; },
    async saveSettings(settings) { if(!client) throw new Error('Supabase belum dikonfigurasi.'); const {error}=await client.from('store_settings').update({...settings,updated_at:new Date().toISOString()}).eq('id',true); fail(error); },
    async upsertProduct(product) { if(!client) throw new Error('Supabase belum dikonfigurasi.'); if(!(await this.isAdmin())) throw new Error('Hanya admin yang boleh mempublikasikan produk.'); const {data:{user}}=await client.auth.getUser(); const row=toRow(product,user?.id); const {error}=await client.from('products').upsert(row,{onConflict:'id'}); fail(error); },
    async publishProducts(products) { if(!client) throw new Error('Supabase belum dikonfigurasi.'); if(!(await this.isAdmin())) throw new Error('Hanya admin yang boleh mempublikasikan.'); const {data:{user}}=await client.auth.getUser(); const rows=products.map((s)=>toRow(s,user?.id)); if(rows.length){const {error}=await client.from('products').upsert(rows,{onConflict:'id'}); fail(error);} },
    async deleteProduct(id) { if(!client) throw new Error('Supabase belum dikonfigurasi.'); if(!(await this.isAdmin())) throw new Error('Hanya admin yang boleh menghapus produk.'); const {error}=await client.from('products').delete().eq('id',String(id)); fail(error); },
    async getCart() { if(!client) return []; const {data:{user}}=await client.auth.getUser(); if(!user) return []; const {data,error}=await client.from('cart_items').select('product_id,quantity').eq('user_id',user.id); fail(error); return (data||[]).map(x=>({id:x.product_id,qty:x.quantity})); },
    async setCart(items) { if(!client) throw new Error('Supabase belum dikonfigurasi.'); const {data:{user}}=await client.auth.getUser(); if(!user) throw new Error('Login akun untuk menyinkronkan keranjang.'); const {error:delError}=await client.from('cart_items').delete().eq('user_id',user.id); fail(delError); if(items.length){const rows=items.map(x=>({user_id:user.id,product_id:x.id,quantity:Math.max(1,Math.min(99,Number(x.qty)||1))})); const {error}=await client.from('cart_items').upsert(rows,{onConflict:'user_id,product_id'}); fail(error);} const {error}=await client.from('carts').upsert({user_id:user.id,updated_at:new Date().toISOString()}); fail(error); }
  };
})();
