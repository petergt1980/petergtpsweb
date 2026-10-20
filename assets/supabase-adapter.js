(() => {
  const cfg = window.PETER_SUPABASE_CONFIG || {};
  const ready = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cfg.url || '') && !!cfg.anonKey && !String(cfg.anonKey).includes('YOUR_');
  window.PeterStoreDB = {
    ready,
    client: ready ? window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null,
    async signIn(email, password) { if (!this.ready) throw new Error('Konfigurasi Supabase belum diisi.'); const {data,error}=await this.client.auth.signInWithPassword({email,password}); if(error) throw error; return data; },
    async signOut() { if(this.client) { const {error}=await this.client.auth.signOut(); if(error) throw error; } },
    async isAdmin() { if(!this.client) return false; const {data:{user}}=await this.client.auth.getUser(); if(!user) return false; const {data,error}=await this.client.from('user_roles').select('role').eq('user_id',user.id).maybeSingle(); if(error) throw error; return data?.role === 'admin'; },
    async getProducts() { if(!this.client) return []; const {data,error}=await this.client.from('products').select('*').eq('published',true).order('created_at',{ascending:false}); if(error) throw error; return data||[]; },
    async getSettings() { if(!this.client) return null; const {data,error}=await this.client.from('store_settings').select('*').eq('id',true).single(); if(error) throw error; return data; },
    async getCart() { if(!this.client) return []; const {data:{user}}=await this.client.auth.getUser(); if(!user) return []; const {data,error}=await this.client.from('cart_items').select('product_id,quantity').eq('user_id',user.id); if(error) throw error; return (data||[]).map(x=>({id:x.product_id,qty:x.quantity})); },
    async setCart(items) { if(!this.client) throw new Error('Supabase belum dikonfigurasi.'); const {data:{user}}=await this.client.auth.getUser(); if(!user) throw new Error('Login akun pembeli untuk menyinkronkan keranjang.'); const {error:delError}=await this.client.from('cart_items').delete().eq('user_id',user.id); if(delError) throw delError; if(items.length){const rows=items.map(x=>({user_id:user.id,product_id:x.id,quantity:Math.max(1,Math.min(99,Number(x.qty)||1))})); const {error}=await this.client.from('cart_items').upsert(rows,{onConflict:'user_id,product_id'}); if(error) throw error;} await this.client.from('carts').upsert({user_id:user.id,updated_at:new Date().toISOString()}); },
  };
})();
