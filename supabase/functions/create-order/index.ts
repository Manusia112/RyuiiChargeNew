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

/**
 * Try inserting into `transactions` progressively.
 * user_id is included in ALL levels so it's never lost on fallback.
 */
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
  // Level 1 — all real columns (selling_price/customer_email/zone_id/nickname/snap_* tidak ada di schema, dibuang)
  const { error: e1 } = await supabase.from("transactions").insert({
    invoice_id:         invoiceId,
    product_id:         resolvedProductId,
    player_id,
    game_slug,
    denomination_label,
    status:             "pending",
    amount:             paymentAmount,
    user_id,
  });
  if (!e1) { console.log("[create-order] Full insert OK:", invoiceId); return; }
  console.warn("[create-order] Full insert failed:", e1.message);

  // Level 2 — drop game_slug + denomination_label (in case any constraint), keep amount
  const { error: e2 } = await supabase.from("transactions").insert({
    invoice_id:         invoiceId,
    product_id:         resolvedProductId,
    player_id,
    status:             "pending",
    amount:             paymentAmount,
    user_id,
  });
  if (!e2) { console.log("[create-order] Level-2 insert OK:", invoiceId); return; }
  console.warn("[create-order] Level-2 insert failed:", e2.message);

  // Level 3 — minimal but STILL include amount so price is preserved
  const { error: e3 } = await supabase.from("transactions").insert({
    invoice_id:         invoiceId,
    product_id:         resolvedProductId,
    player_id,
    game_slug,
    denomination_label,
    status:             "pending",
    amount:             paymentAmount,
    user_id,
  });
  if (!e3) { console.log("[create-order] Level-3 insert OK:", invoiceId); return; }
  console.warn("[create-order] Level-3 insert failed:", e3.message);

  // Level 4 — bare minimum but tetap kirim amount supaya tidak NULL
  const { error: e4 } = await supabase.from("transactions").insert({
    invoice_id: invoiceId,
    product_id: resolvedProductId,
    player_id,
    status:     "pending",
    amount:     paymentAmount,
    user_id,
  });
  if (!e4) { console.log("[create-order] Bare insert OK:", invoiceId); return; }
  console.error("[create-order] All insert attempts failed:", e4.message);
  throw new Error(e4.message);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405);

  try {
    const supabaseUrl          = Deno.env.get("SUPABASE_URL");
    const serviceKey           = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey              = Deno.env.get("SUPABASE_ANON_KEY");
    const midtransServerKey    = Deno.env.get("MIDTRANS_SERVER_KEY");
    const midtransIsProduction = Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true";

    const body = await req.json();
    const {
      product_id,
      player_id,
      zone_id,
      denomination_label,
      denomination_price,
      game_slug,
      nickname,
      customer_email: bodyEmail,
      user_id: bodyUserId,
    } = body;

    if (!product_id || !player_id) {
      return json({ success: false, message: "product_id dan player_id wajib diisi" }, 400);
    }

    // ── Resolve authenticated user ─────────────────────────────────────────────
    // Priority: JWT from Authorization header → user_id from body → null (guest)
    let resolvedUserId: string | null = bodyUserId ?? null;
    let resolvedEmail: string | null  = bodyEmail ?? null;

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwtToken   = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (jwtToken && supabaseUrl && anonKey) {
      try {
        // Use anon client with user's JWT to validate identity server-side
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: `Bearer ${jwtToken}` } },
        });
        const { data: { user }, error: authErr } = await userClient.auth.getUser();
        if (!authErr && user) {
          resolvedUserId = user.id;
          resolvedEmail  = user.email ?? resolvedEmail;
          console.log("[create-order] Auth via JWT OK — user:", resolvedUserId);
        } else {
          console.warn("[create-order] JWT validation failed:", authErr?.message ?? "no user");
        }
      } catch (authEx) {
        console.warn("[create-order] JWT validation exception:", authEx);
      }
    }

    if (!resolvedUserId) {
      console.log("[create-order] Proceeding as guest (no authenticated user)");
    }

    // ── Product lookup ─────────────────────────────────────────────────────────
    let sellingPrice: number = 0;
    let productName: string  = "";
    let digiflazzSku: string | null = null;

    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey);

      const cols = "id, name, slug, selling_price, cost_price, digiflazz_sku";

      const fetchProduct = async (table: string, withActive: boolean) => {
        let q1 = supabase.from(table).select(cols).eq("slug", product_id);
        if (withActive) q1 = q1.eq("is_active", true);
        let r1 = await q1.maybeSingle();
        if (r1.data || r1.error) return { product: r1.data, error: r1.error };

        let q2 = supabase.from(table).select(cols).eq("id", product_id);
        if (withActive) q2 = q2.eq("is_active", true);
        const r2 = await q2.maybeSingle();
        return { product: r2.data, error: r2.error };
      };

      // PRIMARY: products_public (view that includes profit margin / final selling price)
      let { product, error } = await fetchProduct("products_public", false);

      // FALLBACK: products (raw table) with is_active filter
      if (!product) {
        console.warn("[create-order] products_public empty/unavailable, falling back to products");
        const r = await fetchProduct("products", true);
        product = r.product;
        error   = r.error;
      }

      if (error && !product) {
        console.error("[create-order] DB lookup error:", error.message);
        return json({ success: false, message: "Gagal mengambil data produk" }, 500);
      }
      if (!product) {
        return json({ success: false, message: "Produk tidak ditemukan atau tidak aktif" }, 404);
      }

      // STRICT: bind exactly to `selling_price` column (per user directive)
      const validPrice = parseInt(product.selling_price);
      console.log("[create-order] Resolved product:", {
        id: product.id, slug: product.slug,
        validPrice, raw_selling: product.selling_price, raw_cost: product.cost_price,
      });

      if (!validPrice || validPrice <= 0) {
        throw new Error("Invalid selling_price (kolom kosong atau 0)");
      }

      sellingPrice = validPrice;
      productName  = denomination_label ? `${product.name} — ${denomination_label}` : product.name;
      digiflazzSku = product.digiflazz_sku ?? null;
    } else {
      sellingPrice = Number(denomination_price) || 0;
      productName  = denomination_label || "Demo Product";
    }

    if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
      return json({ success: false, message: "Harga produk tidak valid" }, 400);
    }

    const random4           = Math.random().toString(36).slice(2, 6).toUpperCase();
    const invoiceId         = `RYUII-${Date.now()}-${random4}`;
    const paymentAmount     = Math.round(sellingPrice);
    const resolvedProductId = digiflazzSku || product_id;

    console.log("[create-order] user_id binding:", resolvedUserId ?? "guest", "| invoice:", invoiceId);

    // ── STEP 1: Save transaction BEFORE calling Midtrans ──────────────────────
    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey);
      try {
        await saveTransaction(
          supabase,
          invoiceId,
          resolvedProductId,
          player_id,
          game_slug          ?? null,
          denomination_label ?? null,
          paymentAmount,
          resolvedEmail,
          zone_id            ?? null,
          nickname           ?? null,
          "",     // snap_token placeholder — updated in STEP 4
          null,
          resolvedUserId,
        );
      } catch (insertErr) {
        console.error("[create-order] Cannot save transaction, aborting:", insertErr);
        return json({ success: false, message: "Gagal menyimpan transaksi ke database. Coba lagi." }, 500);
      }
    }

    // ── STEP 2: Demo mode ──────────────────────────────────────────────────────
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

    // ── STEP 3: Call Midtrans Snap API ─────────────────────────────────────────
    const midtransBaseUrl = midtransIsProduction
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.midtrans.com/snap/v1/transactions";

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
        email: resolvedEmail || "guest@ryuiicharge.id",
        ...(nickname ? { first_name: nickname } : {}),
      },
      callbacks: {
        finish: "https://ryuiicharge.my.id",
      },
      // ── Custom expiry: payment link valid for 30 minutes ──
      expiry: {
        duration: 30,
        unit: "minutes",
      },
      // NOTE: `enabled_payments` is intentionally OMITTED so Midtrans
      // uses the payment-method whitelist configured in the Midtrans Dashboard.
      // DO NOT add `enabled_payments` here — it would override the dashboard.
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
      return json({
        success: false,
        message: midtransResult.error_messages?.join(", ") ?? midtransResult.status_message ?? "Gagal membuat transaksi pembayaran",
      }, 502);
    }

    console.log("[create-order] Midtrans token OK for:", invoiceId);

    // ── STEP 4: Persist Midtrans token & redirect URL (best-effort, dual-naming) ──
    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey);

      // Try snap_* column names first (current schema)
      const { error: updErr1 } = await supabase
        .from("transactions")
        .update({ snap_token: midtransResult.token, snap_redirect_url: midtransResult.redirect_url ?? null })
        .eq("invoice_id", invoiceId);
      if (updErr1) {
        console.warn("[create-order] snap_* update skipped:", updErr1.message);
      }

      // Also try payment_* column names (per user directive)
      const { error: updErr2 } = await supabase
        .from("transactions")
        .update({ payment_token: midtransResult.token, payment_url: midtransResult.redirect_url ?? null })
        .eq("invoice_id", invoiceId);
      if (updErr2) {
        console.warn("[create-order] payment_* update skipped:", updErr2.message);
      }
    }

    // ── STEP 5: Return BOTH token AND redirect_url so frontend can show "Lanjutkan Pembayaran" ──
    return json({
      success:       true,
      token:         midtransResult.token,
      payment_token: midtransResult.token,
      redirect_url:  midtransResult.redirect_url ?? null,
      payment_url:   midtransResult.redirect_url ?? null,
      invoiceId,
      amount:        paymentAmount,
      productName,
    });
  } catch (err) {
    console.error("[create-order] Unexpected error:", err);
    return json({ success: false, message: "Terjadi kesalahan server" }, 500);
  }
});
