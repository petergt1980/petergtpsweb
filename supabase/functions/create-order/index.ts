import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, x-supabase-api-version, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json();
    const customer = body?.customer || {};
    const name = String(customer.customer_name || "").trim().slice(0, 100);
    const whatsapp = String(customer.customer_whatsapp || "").replace(/[^\d+]/g, "").slice(0, 18);
    const items = Array.isArray(body?.items) ? body.items : [];
    if (name.length < 2) return json({ error: "Nama pemesan wajib diisi." }, 400);
    if (!/^\+?\d{9,16}$/.test(whatsapp)) return json({ error: "Nomor WhatsApp tidak valid." }, 400);
    if (!items.length || items.length > 30) return json({ error: "Keranjang kosong atau terlalu banyak item." }, 400);

    const normalized = new Map<string, number>();
    for (const item of items) {
      const id = String(item?.id || "").slice(0, 150);
      const qty = Math.floor(Number(item?.qty));
      if (!id || !Number.isFinite(qty) || qty < 1 || qty > 99) return json({ error: "Item/kuantitas tidak valid." }, 400);
      normalized.set(id, Math.min(99, (normalized.get(id) || 0) + qty));
    }
    const ids = [...normalized.keys()];
    const { data: products, error: productError } = await adminClient
      .from("products")
      .select("id,name,filename,price,for_sale,published")
      .in("id", ids);
    if (productError) throw productError;
    const byId = new Map((products || []).map((p: any) => [p.id, p]));
    const orderItems = [];
    let total = 0;
    for (const [id, qty] of normalized.entries()) {
      const p: any = byId.get(id);
      if (!p || !p.published || !p.for_sale || Number(p.price) <= 0) {
        return json({ error: "Salah satu produk tidak tersedia untuk dibeli." }, 400);
      }
      const price = Number(p.price);
      total += price * qty;
      orderItems.push({ product_id: p.id, name: p.name, filename: p.filename, price, quantity: qty });
    }

    const { data: { user } } = await userClient.auth.getUser();
    const { data: order, error: orderError } = await adminClient.from("orders").insert({
      user_id: user?.id || null,
      status: "pending",
      items: orderItems.map((x) => ({ product_id: x.product_id, name: x.name, filename: x.filename, price: x.price, quantity: x.quantity })),
      total,
      customer_name: name,
      customer_whatsapp: whatsapp,
      customer_note: "Checkout dari website PeterGTPS Store",
    }).select("id,created_at,total").single();
    if (orderError) throw orderError;

    // WhatsApp Cloud API credentials live in Supabase Edge Function secrets only.
    const token = Deno.env.get("WHATSAPP_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const recipient = Deno.env.get("WHATSAPP_TO");
    let whatsappSent = false;
    let whatsappError = "";
    if (token && phoneNumberId && recipient) {
      const lines = orderItems.map((x) => `- ${x.name} x${x.quantity}: Rp${(x.price * x.quantity).toLocaleString("id-ID")}`).join("\n");
      const message = `🛒 ORDER BARU — PeterGTPS Store\nOrder: ${order.id}\nNama: ${name}\nWhatsApp pembeli: ${whatsapp}\n\n${lines}\n\nTotal: Rp${total.toLocaleString("id-ID")}\nStatus: PENDING\n\nHubungi pembeli untuk konfirmasi pembayaran.`;
      const waRes = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: "text",
          text: { preview_url: false, body: message },
        }),
      });
      whatsappSent = waRes.ok;
      if (!waRes.ok) whatsappError = (await waRes.text()).slice(0, 300);
    } else {
      whatsappError = "WhatsApp Cloud API belum dikonfigurasi di Supabase Secrets.";
    }

    return json({ ok: true, order_id: order.id, total, whatsapp_sent: whatsappSent, whatsapp_error: whatsappError || undefined });
  } catch (err) {
    console.error("create-order error", err);
    return json({ error: "Gagal membuat pesanan. Periksa konfigurasi Edge Function dan schema database." }, 500);
  }
});
