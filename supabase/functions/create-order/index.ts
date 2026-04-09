import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

/** Try inserting a row, progressively dropping optional columns on schema error */
async function saveTransaction(
  supabase: ReturnType<typeof createClient>,
  invoiceId: string,
  resolvedProductId: string,
  player_id: string,
  game_slug: string | null,
  denomination_label: string | null,
  paymentAmount: number,
  customer_email: string | null,
  zone_id: string | null,
  nickname: string | null,
  snap_token: string,
  snap_redirect_url: string | null,
  user_id: string | null,
): Promise<void> {
  const full: Record<string, unknown> = {
    invoice_id:         invoiceId,
    product_id:         resolvedProductId,
    player_id,
    game_slug,
    denomination_label,
    status:             "pending",
    selling_price:      paymentAmount,
    customer_email,
    zone_id,
    nickname,
    snap_token,
    snap_redirect_url,
    user_id,
  };

  const { error: e1 } = await supabase.from("transactions").insert(full);
  if (!e1) { console.log("[create-order] Full insert OK:", invoiceId); return; }
  console.warn("[create-order] Full insert failed:", e1.message);

  const minimal: Record<string, unknown> = {
    invoice_id:         invoiceId,
    product_id:         resolvedProductId,
    player_id,
    game_slug,
    denomination_label,
    status:             "pending",
    selling_price:      paymentAmount,
    customer_email,
    zone_id,
    nickname,
  };

  const { error: e2 } = await supabase.from("transactions").insert(minimal);
  if (!e2) { console.log("[create-order] Minimal insert OK:", invoiceId); return; }
  console.warn("[create-order] Minimal insert failed:", e2.message);

  const bare: Record<string, unknown> = {
    invoice_id: invoiceId,
    product_id: resolvedProductId,
    player_id,
    status:     "pending",
  };

  const { error: e3 } = await supabase.from("transactions").insert(bare);
  if (!e3) { console.log("[create-order] Bare insert OK:", invoiceId); return; }
  console.error("[create-order] All insert attempts failed:", e3.message);
  throw new Error(e3.message);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405);

  try {
    const supabaseUrl          = Deno.env.get("SUPABASE_URL");
    const serviceKey           = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const midtransServerKey    = Deno.env.get("MIDTRANS_SERVER_KEY");
    const midtransIsProduction = Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true";

    const {
      product_id,
      player_id,
      zone_id,
      denomination_label,
      denomination_price,
      game_slug,
      nickname,
      customer_email,
      user_id,
    } = await req.json();

    if (!product_id || !player_id) {
      return json({ success: false, message: "product_id dan player_id wajib diisi" }, 400);
    }

    let sellingPrice: number = 0;
    let productName: string  = "";
    let digiflazzSku: string | null = null;

    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey);

      let { data: product, error } = await supabase
        .from("products")
        .select("id, name, slug, selling_price, cost_price, is_active, digiflazz_sku")
        .eq("slug", product_id)
        .eq("is_active", true)
        .maybeSingle();

      if (!product && !error) {
        const { data: byId, error: idErr } = await supabase
          .from("products")
          .select("id, name, slug, selling_price, cost_price, is_active, digiflazz_sku")
          .eq("id", product_id)
          .eq("is_active", true)
          .maybeSingle();
        product = byId;
        error   = idErr;
      }

      if (error) {
        console.error("[create-order] DB lookup error:", error.message);
        return json({ success: false, message: "Gagal mengambil data produk" }, 500);
      }

      if (!product) {
        return json({ success: false, message: "Produk tidak ditemukan atau tidak aktif" }, 404);
      }

      sellingPrice = product.selling_price ?? product.cost_price ?? 0;
      productName  = denomination_label ? `${product.name} — ${denomination_label}` : product.name;
      digiflazzSku = product.digiflazz_sku ?? null;
    } else {
      sellingPrice = denomination_price || 0;
      productName  = denomination_label || "Demo Product";
    }

    if (sellingPrice <= 0) {
      return json({ success: false, message: "Harga produk tidak valid" }, 400);
    }

    const random4           = Math.random().toString(36).slice(2, 6).toUpperCase();
    const invoiceId         = `RYUII-${Date.now()}-${random4}`;
    const paymentAmount     = Math.round(sellingPrice);
    const resolvedProductId = digiflazzSku || product_id;

    // ── STEP 1: Save transaction to DB BEFORE calling Midtrans ────────────────
    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey);
      try {
        await saveTransaction(
          supabase,
          invoiceId,
          resolvedProductId,
          player_id,
          game_slug    ?? null,
          denomination_label ?? null,
          paymentAmount,
          customer_email ?? null,
          zone_id        ?? null,
          nickname       ?? null,
          "",           // snap_token placeholder — updated after Midtrans responds
          null,
          user_id ?? null,
        );
      } catch (insertErr) {
        console.error("[create-order] Cannot save transaction, aborting:", insertErr);
        return json({ success: false, message: "Gagal menyimpan transaksi ke database. Coba lagi." }, 500);
      }
    }

    // ── STEP 2: Demo mode (no Midtrans key) ──────────────────────────────────
    if (!midtransServerKey) {
      return json({
        success: true,
        token:   "DEMO-TOKEN",
        invoiceId,
        amount:  paymentAmount,
        productName,
        message: "Demo mode — MIDTRANS_SERVER_KEY not configured",
      });
    }

    // ── STEP 3: Call Midtrans Snap API ────────────────────────────────────────
    const midtransBaseUrl = midtransIsProduction
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";

    const authString = btoa(`${midtransServerKey}:`);

    const midtransPayload: Record<string, unknown> = {
      transaction_details: {
        order_id:     invoiceId,
        gross_amount: paymentAmount,
      },
      item_details: [
        {
          id:       resolvedProductId,
          price:    paymentAmount,
          quantity: 1,
          name:     productName.length > 50 ? productName.slice(0, 50) : productName,
        },
      ],
      customer_details: {
        email: customer_email || "guest@ryuiicharge.id",
        ...(nickname ? { first_name: nickname } : {}),
      },
      callbacks: {
        finish: "https://ryuiicharge.my.id",
      },
    };

    console.log("[create-order] Calling Midtrans Snap:", { order_id: invoiceId, gross_amount: paymentAmount, sku: resolvedProductId });

    const midtransResp = await fetch(midtransBaseUrl, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Basic ${authString}`,
        "Accept":        "application/json",
      },
      body: JSON.stringify(midtransPayload),
    });

    const midtransResult = await midtransResp.json() as {
      token?: string;
      redirect_url?: string;
      error_messages?: string[];
      status_message?: string;
    };

    if (!midtransResp.ok || !midtransResult.token) {
      console.error("[create-order] Midtrans error:", JSON.stringify(midtransResult));
      const errMsg =
        midtransResult.error_messages?.join(", ") ??
        midtransResult.status_message ??
        "Gagal membuat transaksi pembayaran";
      return json({ success: false, message: errMsg }, 502);
    }

    console.log("[create-order] Midtrans token OK for:", invoiceId);

    // ── STEP 4: Update transaction with snap token ─────────────────────────────
    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey);
      const { error: updErr } = await supabase
        .from("transactions")
        .update({
          snap_token:        midtransResult.token,
          snap_redirect_url: midtransResult.redirect_url ?? null,
        })
        .eq("invoice_id", invoiceId);

      if (updErr) {
        console.warn("[create-order] Could not update snap_token (column may not exist):", updErr.message);
      }
    }

    return json({
      success:     true,
      token:       midtransResult.token,
      invoiceId,
      amount:      paymentAmount,
      productName,
    });
  } catch (err) {
    console.error("[create-order] Unexpected error:", err);
    return json({ success: false, message: "Terjadi kesalahan server" }, 500);
  }
});
