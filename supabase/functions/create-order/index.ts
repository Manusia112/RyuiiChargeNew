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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ success: false, message: "Method not allowed" }, 405);

  try {
    const supabaseUrl      = Deno.env.get("SUPABASE_URL");
    const serviceKey       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const midtransServerKey = Deno.env.get("MIDTRANS_SERVER_KEY");
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
      payment_method,
      user_id,
    } = await req.json();

    if (!product_id || !player_id) {
      return json({ success: false, message: "product_id dan player_id wajib diisi" }, 400);
    }

    let sellingPrice: number = 0;
    let productName: string = "";
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
        error = idErr;
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

    const random4   = Math.random().toString(36).slice(2, 6).toUpperCase();
    const invoiceId = `RYUII-${Date.now()}-${random4}`;
    const paymentAmount = Math.round(sellingPrice);

    const resolvedProductId = digiflazzSku || product_id;

    if (!midtransServerKey) {
      return json({
        success: true,
        token: "DEMO-TOKEN",
        invoiceId,
        amount: paymentAmount,
        productName,
        message: "Demo mode — MIDTRANS_SERVER_KEY not configured",
      });
    }

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
    };

    console.log("[create-order] Creating Midtrans Snap transaction:", {
      order_id:     invoiceId,
      gross_amount: paymentAmount,
      product:      productName,
      sku:          resolvedProductId,
    });

    const midtransResp = await fetch(midtransBaseUrl, {
      method: "POST",
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

    console.log("[create-order] Midtrans token received for:", invoiceId);

    if (supabaseUrl && serviceKey) {
      const supabase = createClient(supabaseUrl, serviceKey);
      const { error: insertError } = await supabase.from("transactions").insert({
        invoice_id:         invoiceId,
        product_id:         resolvedProductId,
        player_id:          player_id,
        zone_id:            zone_id ?? null,
        game_slug:          game_slug ?? null,
        denomination_label: denomination_label ?? null,
        selling_price:      paymentAmount,
        status:             "pending",
        payment_method:     payment_method ?? null,
        customer_email:     customer_email ?? null,
        nickname:           nickname ?? null,
        snap_token:         midtransResult.token,
        snap_redirect_url:  midtransResult.redirect_url ?? null,
        user_id:            user_id ?? null,
      });

      if (insertError) {
        console.error("[create-order] Failed to insert transaction:", insertError.message);
        return json({ success: false, message: "Gagal menyimpan transaksi. Silakan coba lagi." }, 500);
      }
    }

    return json({
      success:   true,
      token:     midtransResult.token,
      invoiceId,
      amount:    paymentAmount,
      productName,
    });
  } catch (err) {
    console.error("[create-order] Unexpected error:", err);
    return json({ success: false, message: "Terjadi kesalahan server" }, 500);
  }
});
