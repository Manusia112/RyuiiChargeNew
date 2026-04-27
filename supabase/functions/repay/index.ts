import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
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
 * `repay` — regenerate a Midtrans Snap token for an EXISTING transaction
 * whose previous Snap session expired/was abandoned.
 *
 * Strict rule (per UX directive): this function MUST NOT insert a new row.
 * It looks up the original transaction by `original_invoice_id` and updates
 * THAT row in place with the new invoice_id + payment_token. This guarantees
 * the user only ever sees ONE entry per purchase intent in their history.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST")    return json({ success: false, message: "Method not allowed" }, 405);

  try {
    const supabaseUrl          = Deno.env.get("SUPABASE_URL");
    const serviceKey           = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const midtransServerKey    = Deno.env.get("MIDTRANS_SERVER_KEY");
    const midtransIsProduction = Deno.env.get("MIDTRANS_IS_PRODUCTION") === "true";

    const body = await req.json();

    const originalInvoiceId = String(
      body.original_invoice_id ?? body.originalInvoiceId ?? body.invoice_id ?? ""
    ).trim();

    if (!originalInvoiceId) {
      return json({ success: false, message: "original_invoice_id wajib diisi" }, 400);
    }
    if (!supabaseUrl || !serviceKey) {
      return json({ success: false, message: "Supabase belum dikonfigurasi" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Lookup the existing row ──────────────────────────────────────────
    const { data: existing, error: lookupError } = await supabase
      .from("transactions")
      .select("*")
      .eq("invoice_id", originalInvoiceId)
      .maybeSingle();

    if (lookupError) {
      console.error("[repay] Lookup error:", lookupError.message);
      return json({ success: false, message: "Gagal mencari transaksi" }, 500);
    }
    if (!existing) {
      return json({ success: false, message: "Transaksi asli tidak ditemukan" }, 404);
    }

    // Resolve price across the legacy column variants
    const incomingAmount = Number(
      body.selling_price ?? body.amount ?? body.gross_amount ?? body.total_price ?? 0
    );
    const existingAmount = Number(
      (existing as Record<string, unknown>).selling_price ??
      (existing as Record<string, unknown>).amount ??
      (existing as Record<string, unknown>).total_price ?? 0
    );
    const paymentAmount = Math.round(incomingAmount > 0 ? incomingAmount : existingAmount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return json({ success: false, message: "Harga transaksi tidak valid" }, 400);
    }

    const productId         = String(body.product_id ?? (existing as Record<string, unknown>).product_id ?? "");
    const playerId          = String(body.player_id ?? (existing as Record<string, unknown>).player_id ?? "");
    const denominationLabel = String(
      body.denomination_label ?? (existing as Record<string, unknown>).denomination_label ?? ""
    );
    const gameSlug          = String(body.game_slug ?? (existing as Record<string, unknown>).game_slug ?? "");
    const customerEmail     =
      ((existing as Record<string, unknown>).customer_email as string | null) ?? "guest@ryuiicharge.id";

    // ── Generate new invoice_id (Midtrans rejects reused order_id) ──────
    const random4      = Math.random().toString(36).slice(2, 6).toUpperCase();
    const newInvoiceId = `RYUII-${Date.now()}-${random4}`;
    const productName  = denominationLabel || productId || "Top-up";

    // ── Demo mode (no Midtrans key) ─────────────────────────────────────
    if (!midtransServerKey) {
      const { error: updErr } = await supabase
        .from("transactions")
        .update({
          invoice_id:    newInvoiceId,
          payment_token: "DEMO-TOKEN",
          snap_token:    "DEMO-TOKEN",
          status:        "pending",
        })
        .eq("invoice_id", originalInvoiceId);
      if (updErr) console.warn("[repay] demo update warn:", updErr.message);

      return json({
        success: true,
        token: "DEMO-TOKEN",
        newInvoiceId,
        message: "Demo mode — MIDTRANS_SERVER_KEY not configured",
      });
    }

    // ── Call Midtrans Snap with the new invoice_id ──────────────────────
    const midtransBaseUrl = midtransIsProduction
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.midtrans.com/snap/v1/transactions";

    const authString = btoa(`${midtransServerKey}:`);

    const midtransPayload: Record<string, unknown> = {
      transaction_details: {
        order_id:     newInvoiceId,
        gross_amount: paymentAmount,
      },
      item_details: [
        {
          id:       productId || newInvoiceId,
          price:    paymentAmount,
          quantity: 1,
          name:     productName.length > 50 ? productName.slice(0, 50) : productName,
        },
      ],
      customer_details: {
        email: customerEmail,
      },
      callbacks: {
        finish: "https://ryuiicharge.my.id",
      },
      // Same 30-minute window as create-order
      expiry: { duration: 30, unit: "minutes" },
      // NOTE: enabled_payments intentionally OMITTED so Midtrans uses the
      // dashboard whitelist. Do NOT add it.
    };

    console.log("[repay] Calling Midtrans Snap:", { order_id: newInvoiceId, gross_amount: paymentAmount });

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
      console.error("[repay] Midtrans error:", JSON.stringify(midtransResult));
      return json({
        success: false,
        message: midtransResult.error_messages?.join(", ") ??
                 midtransResult.status_message ??
                 "Gagal membuat ulang pembayaran",
      }, 502);
    }

    // ── UPDATE the existing row in-place (no insert, no duplicate) ──────
    // Try with snap_* + payment_* columns; fall back gracefully if a
    // column doesn't exist in the schema.
    const updatePayloadFull: Record<string, unknown> = {
      invoice_id:        newInvoiceId,
      payment_token:     midtransResult.token,
      snap_token:        midtransResult.token,
      payment_url:       midtransResult.redirect_url ?? null,
      snap_redirect_url: midtransResult.redirect_url ?? null,
      status:            "pending",
      // Refresh created_at so the 30-minute countdown restarts from now.
      created_at:        new Date().toISOString(),
    };

    let { error: updErr } = await supabase
      .from("transactions")
      .update(updatePayloadFull)
      .eq("invoice_id", originalInvoiceId);

    if (updErr) {
      console.warn("[repay] full update failed, retrying minimal:", updErr.message);
      const minimal: Record<string, unknown> = {
        invoice_id:    newInvoiceId,
        payment_token: midtransResult.token,
        status:        "pending",
      };
      const retry = await supabase
        .from("transactions")
        .update(minimal)
        .eq("invoice_id", originalInvoiceId);
      updErr = retry.error;
    }

    if (updErr) {
      console.error("[repay] Could not update existing row:", updErr.message);
      return json({
        success: false,
        message: "Gagal memperbarui transaksi (DB error)",
      }, 500);
    }

    console.log("[repay] Row updated in-place:", originalInvoiceId, "→", newInvoiceId);

    return json({
      success:       true,
      token:         midtransResult.token,
      payment_token: midtransResult.token,
      redirect_url:  midtransResult.redirect_url ?? null,
      newInvoiceId,
      amount:        paymentAmount,
      productName,
    });
  } catch (err) {
    console.error("[repay] Unexpected error:", err);
    return json({ success: false, message: "Terjadi kesalahan server" }, 500);
  }
});
