import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHash } from "node:crypto";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** MD5 digest (hex) — used for Digiflazz request signature.
 *  NOTE: Supabase Edge Runtime (Deno) tidak support "MD5" via crypto.subtle.digest
 *  ("Unrecognized algorithm name"), jadi kita pakai node:crypto yang JALAN. */
async function md5(input: string): Promise<string> {
  return createHash("md5").update(input).digest("hex");
}

/** Midtrans transaction_status → internal status */
function mapStatus(transactionStatus: string, fraudStatus?: string): string {
  if (transactionStatus === "settlement") return "success";
  if (transactionStatus === "capture") {
    return fraudStatus === "accept" ? "success" : "failed";
  }
  if (transactionStatus === "pending") return "pending";
  if (["deny", "cancel", "expire", "failure"].includes(transactionStatus)) return "failed";
  return "pending";
}

/** Midtrans payment_type → human-readable label */
function mapPaymentType(paymentType: string): string {
  const map: Record<string, string> = {
    qris:               "QRIS",
    shopeepay:          "ShopeePay",
    gopay:              "GoPay",
    bank_transfer:      "Transfer Bank",
    echannel:           "Mandiri Bill",
    cstore:             "Minimarket",
    credit_card:        "Kartu Kredit",
    bca_klikpay:        "BCA KlikPay",
    bri_epay:           "BRI ePay",
    cimb_clicks:        "CIMB Clicks",
    danamon_online:     "Danamon Online",
    akulaku:            "Akulaku",
    kredivo:            "Kredivo",
    over_the_counter:   "Minimarket",
  };
  return map[paymentType] ?? paymentType.toUpperCase().replace(/_/g, " ");
}

// ── Digiflazz top-up proxy ───────────────────────────────────────────────────

interface DigiflazzResult {
  success: boolean;
  refId: string;
  message: string;
  rawResponse?: unknown;
}

async function triggerDigiflazzTopup(tx: {
  invoice_id: string;
  product_id: string;
  player_id: string;
  game_slug?: string | null;
  denomination_label?: string | null;
}): Promise<DigiflazzResult> {
  const username = Deno.env.get("DIGIFLAZZ_USERNAME") ?? "";
  const apiKey   = Deno.env.get("DIGIFLAZZ_API_KEY")  ?? "";

  if (!username || !apiKey) {
    console.warn("[Digiflazz] Credentials not configured — skipping top-up");
    return { success: false, refId: tx.invoice_id, message: "Digiflazz credentials not configured" };
  }

  const refId       = tx.invoice_id;
  const buyerSkuCode = tx.product_id;   // product_id maps to Digiflazz buyer_sku_code
  const customerNo   = tx.player_id;    // player_id maps to customer_no (game UID/account)

  // sign = MD5(username + api_key + ref_id)
  const sign = await md5(`${username}${apiKey}${refId}`);

  const payload = {
    endpoint:       "transaction",
    username,
    buyer_sku_code: buyerSkuCode,
    customer_no:    customerNo,
    ref_id:         refId,
    sign,
    testing:        Deno.env.get("DIGIFLAZZ_TESTING") === "true",
  };

  console.log("[Digiflazz] Sending top-up request via proxy:", {
    buyer_sku_code: buyerSkuCode,
    customer_no:    customerNo,
    ref_id:         refId,
  });

  // URL proxy bisa di-override lewat secret PROXY_URL tanpa redeploy
  const proxyUrl = Deno.env.get("PROXY_URL") || "https://ryuiicharge.my.id/proxy.php";
  const proxyAuth = Deno.env.get("PROXY_SECRET")
    ? `Bearer ${Deno.env.get("PROXY_SECRET")}`
    : "Bearer RyuiiChargeOtoritas";

  try {
    const resp = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": proxyAuth,
      },
      body: JSON.stringify(payload),
    });

    // Baca body sebagai text dulu — kalau proxy balas HTML (404) atau kosong (405),
    // resp.json() akan throw silently. Pakai text + JSON.parse supaya error message
    // berisi status code + isi body asli untuk debugging di error_logs.
    const rawText = await resp.text();
    let data: {
      data?: { ref_id?: string; status?: string; message?: string; rc?: string };
    };
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(`Proxy non-JSON (HTTP ${resp.status}) ${proxyUrl} → ${rawText.slice(0, 200) || "[empty body]"}`);
    }

    const inner = data.data;
    const status = inner?.status?.toLowerCase() ?? "";

    console.log("[Digiflazz] Response:", JSON.stringify(data));

    if (status === "sukses") {
      return {
        success: true,
        refId,
        message: inner?.message ?? "Top-up berhasil",
        rawResponse: data,
      };
    }

    // rc = "00" also indicates success in some Digiflazz versions
    if (inner?.rc === "00") {
      return {
        success: true,
        refId,
        message: inner?.message ?? "Top-up berhasil",
        rawResponse: data,
      };
    }

    return {
      success: false,
      refId,
      message: inner?.message ?? "Top-up gagal",
      rawResponse: data,
    };
  } catch (err) {
    console.error("[Digiflazz] Fetch error:", err);
    return {
      success: false,
      refId,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Supabase helpers ─────────────────────────────────────────────────────────

function getClient() {
  const url  = Deno.env.get("SUPABASE_URL")              ?? "";
  const key  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

async function logError(client: ReturnType<typeof createClient>, params: {
  actionType:   string;
  errorMessage: string;
  rawResponse:  unknown;
}) {
  await client.from("error_logs").insert({
    action_type:   params.actionType,
    error_message: params.errorMessage,
    raw_response:  params.rawResponse,
  });
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  // Midtrans only sends POST
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  console.log("=== MIDTRANS CALLBACK RECEIVED ===");

  let body: Record<string, string> = {};
  try {
    body = await req.json() as Record<string, string>;
  } catch {
    console.warn("[midtrans-callback] Could not parse JSON body");
    return new Response("OK", { status: 200 }); // still 200 so Midtrans stops retrying
  }

  const order_id            = (body["order_id"]           ?? "").trim();
  const transaction_status  = (body["transaction_status"] ?? "").trim().toLowerCase();
  const fraud_status        = (body["fraud_status"]       ?? "").trim().toLowerCase();
  const payment_type        = (body["payment_type"]       ?? "").trim().toLowerCase();

  console.log(`[midtrans-callback] order_id=${order_id} status=${transaction_status} fraud=${fraud_status} payment=${payment_type}`);

  if (!order_id || !transaction_status) {
    console.warn("[midtrans-callback] Missing required fields — ignoring");
    return new Response("OK", { status: 200 });
  }

  const mappedPaymentType = mapPaymentType(payment_type);
  const client            = getClient();

  if (!client) {
    console.warn("[midtrans-callback] Supabase not configured — cannot update DB");
    return new Response("OK", { status: 200 });
  }

  // ── 1. Handle FAILURE statuses (expire / cancel / deny / failure) ─────────
  //    Update the transaction row to status='Gagal' and DO NOT fire the
  //    Digiflazz proxy — there is nothing to inject because payment failed.
  if (["expire", "cancel", "deny", "failure"].includes(transaction_status)) {
    console.log(`[midtrans-callback] Payment failed (${transaction_status}) — setting status='Gagal' for ${order_id}`);

    const { error: failErr } = await client
      .from("transactions")
      .update({
        status:         "Gagal",
        payment_method: mappedPaymentType,
      })
      .eq("invoice_id", order_id);

    if (failErr) {
      console.error("[midtrans-callback] DB update error (fail-path):", failErr);
      await logError(client, {
        actionType:   "MIDTRANS_CALLBACK",
        errorMessage: String(failErr.message),
        rawResponse:  { order_id, transaction_status, fraud_status, payment_type },
      });
    }

    // Always 200 so Midtrans marks the notification as delivered
    return new Response("OK", { status: 200 });
  }

  // ── 2. Determine if this is a SUCCESSFUL payment we should act on ────────
  //    Per directive: ONLY fire the Digiflazz proxy if Midtrans reports
  //    `settlement` OR `capture` (with fraud_status='accept').
  const isSettlement     = transaction_status === "settlement";
  const isAcceptedCapture = transaction_status === "capture" && fraud_status === "accept";
  const isPaid            = isSettlement || isAcceptedCapture;

  // For non-final statuses (pending, captured-but-fraud-challenge, etc.)
  // just persist payment_method + the mapped status and return.
  if (!isPaid) {
    const mappedStatus = mapStatus(transaction_status, fraud_status);
    console.log(`[midtrans-callback] Non-final status: ${transaction_status} → ${mappedStatus} — recording only`);

    await client
      .from("transactions")
      .update({
        status:         mappedStatus,
        payment_method: mappedPaymentType,
      })
      .eq("invoice_id", order_id);

    return new Response("OK", { status: 200 });
  }

  // ── 3. PAID: persist payment method + load the transaction row ───────────
  const { data: rows, error: updateError } = await client
    .from("transactions")
    .update({ payment_method: mappedPaymentType })
    .eq("invoice_id", order_id)
    .select("invoice_id, product_id, player_id, game_slug, denomination_label, status");

  if (updateError) {
    console.error("[midtrans-callback] DB update error:", updateError);
    await logError(client, {
      actionType:   "MIDTRANS_CALLBACK",
      errorMessage: String(updateError.message),
      rawResponse:  { order_id, transaction_status, fraud_status, payment_type },
    });
    return new Response("OK", { status: 200 });
  }

  const updatedRows = rows as Array<{
    invoice_id:         string;
    product_id:         string;
    player_id:          string;
    game_slug:          string | null;
    denomination_label: string | null;
    status:             string;
  }> | null;

  console.log(`[midtrans-callback] Paid — Updated ${updatedRows?.length ?? 0} row(s) for order_id=${order_id}`);

  // ── 4. Fire Digiflazz top-up proxy ────────────────────────────────────────
  if (updatedRows && updatedRows.length > 0) {
    const tx = updatedRows[0];

    console.log("[midtrans-callback] Triggering Digiflazz top-up for:", tx.invoice_id);

    const digiResult = await triggerDigiflazzTopup({
      invoice_id:         tx.invoice_id,
      product_id:         tx.product_id,
      player_id:          tx.player_id,
      game_slug:          tx.game_slug,
      denomination_label: tx.denomination_label,
    });

    if (digiResult.success) {
      console.log("[midtrans-callback] Digiflazz top-up SUCCESS:", digiResult.message);

      // Mark as Berhasil — final confirmation will also be reinforced
      // by the dedicated digiflazz-callback webhook.
      await client
        .from("transactions")
        .update({ status: "Berhasil" })
        .eq("invoice_id", order_id);

    } else {
      console.error("[midtrans-callback] Digiflazz top-up FAILED:", digiResult.message);

      await logError(client, {
        actionType:   "DIGIFLAZZ_TOPUP",
        errorMessage: digiResult.message,
        rawResponse:  digiResult.rawResponse ?? { invoice_id: order_id },
      });

      // Leave as 'processing' so the digiflazz-callback can flip it to
      // Berhasil/Gagal once Digiflazz reports the final outcome.
      await client
        .from("transactions")
        .update({ status: "processing" })
        .eq("invoice_id", order_id);
    }
  }

  // Always 200 so Midtrans marks the notification as delivered
  return new Response("OK", { status: 200 });
});
