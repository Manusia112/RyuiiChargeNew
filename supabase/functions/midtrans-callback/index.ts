import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHash } from "node:crypto";

function md5(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

function sha512(input: string): string {
  return createHash("sha512").update(input).digest("hex");
}

function mapStatus(transactionStatus: string, fraudStatus?: string): string {
  if (transactionStatus === "settlement") return "success";
  if (transactionStatus === "capture") {
    return fraudStatus === "accept" ? "success" : "failed";
  }
  if (transactionStatus === "pending") return "pending";
  if (["deny", "cancel", "expire", "failure"].includes(transactionStatus)) return "failed";
  return "pending";
}

function mapPaymentType(paymentType: string): string {
  const map: Record<string, string> = {
    qris: "QRIS",
    shopeepay: "ShopeePay",
    gopay: "GoPay",
    bank_transfer: "Transfer Bank",
    echannel: "Mandiri Bill",
    cstore: "Minimarket",
    credit_card: "Kartu Kredit",
    bca_klikpay: "BCA KlikPay",
    bri_epay: "BRI ePay",
    cimb_clicks: "CIMB Clicks",
    danamon_online: "Danamon Online",
    akulaku: "Akulaku",
    kredivo: "Kredivo",
    over_the_counter: "Minimarket",
  };
  return map[paymentType] ?? paymentType.toUpperCase().replace(/_/g, " ");
}

async function triggerDigiflazzTopup(tx: {
  invoice_id: string;
  product_id: string;
  player_id: string;
  game_slug?: string | null;
  denomination_label?: string | null;
}): Promise<{ success: boolean; refId: string; message: string; rawResponse?: unknown }> {
  const username = Deno.env.get("DIGIFLAZZ_USERNAME") ?? "";
  const apiKey   = Deno.env.get("DIGIFLAZZ_API_KEY")  ?? "";

  if (!username || !apiKey) {
    console.warn("[Digiflazz] Credentials not configured — skipping top-up");
    return { success: false, refId: tx.invoice_id, message: "Digiflazz credentials not configured" };
  }

  const refId       = tx.invoice_id;
  const buyerSkuCode = tx.product_id;
  const customerNo   = tx.player_id;
  const sign = md5(`${username}${apiKey}${refId}`);

  const payload = {
    username,
    buyer_sku_code: buyerSkuCode,
    customer_no: customerNo,
    ref_id: refId,
    sign,
    testing: Deno.env.get("DIGIFLAZZ_TESTING") === "true",
  };

  console.log("[Digiflazz] Sending top-up request directly:", {
    buyer_sku_code: buyerSkuCode,
    customer_no: customerNo,
    ref_id: refId,
  });

  try {
    const resp = await fetch("https://api.digiflazz.com/v1/transaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const rawText = await resp.text();
    let data: {
      data?: { ref_id?: string; status?: string; message?: string; rc?: string };
    };
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(`Digiflazz API non-JSON (HTTP ${resp.status}): ${rawText.slice(0, 200) || "[empty body]"}`);
    }

    const inner = data.data;
    const status = inner?.status?.toLowerCase() ?? "";

    console.log("[Digiflazz] Response:", JSON.stringify(data));

    if (status === "sukses" || inner?.rc === "00") {
      return { success: true, refId, message: inner?.message ?? "Top-up berhasil", rawResponse: data };
    }

    if (status === "pending" || inner?.rc === "03") {
      console.log("[Digiflazz] Top-up pending — order queued, callback will finalize:", refId);
      return { success: true, refId, message: inner?.message ?? "Top-up pending", rawResponse: data };
    }

    return { success: false, refId, message: inner?.message ?? "Top-up gagal", rawResponse: data };
  } catch (err) {
    console.error("[Digiflazz] Fetch error:", err);
    return { success: false, refId, message: err instanceof Error ? err.message : String(err) };
  }
}

function getClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

async function logError(client: ReturnType<typeof createClient>, params: {
  actionType: string;
  errorMessage: string;
  rawResponse: unknown;
}) {
  await client.from("error_logs").insert({
    action_type: params.actionType,
    error_message: params.errorMessage,
    raw_response: params.rawResponse,
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  console.log("=== MIDTRANS CALLBACK RECEIVED ===");

  let body: Record<string, string> = {};
  try {
    body = await req.json() as Record<string, string>;
  } catch {
    console.warn("[midtrans-callback] Could not parse JSON body");
    return new Response("OK", { status: 200 });
  }

  const order_id            = (body["order_id"]           ?? "").trim();
  const transaction_status  = (body["transaction_status"] ?? "").trim().toLowerCase();
  const fraud_status        = (body["fraud_status"]       ?? "").trim().toLowerCase();
  const payment_type        = (body["payment_type"]       ?? "").trim().toLowerCase();
  const status_code         = (body["status_code"]        ?? "").trim();
  const gross_amount        = (body["gross_amount"]       ?? "").trim();
  const signature_key       = (body["signature_key"]      ?? "").trim();

  console.log(`[midtrans-callback] order_id=${order_id} status=${transaction_status} fraud=${fraud_status} payment=${payment_type}`);

  if (!order_id || !transaction_status) {
    console.warn("[midtrans-callback] Missing required fields — ignoring");
    return new Response("OK", { status: 200 });
  }

  const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY") ?? "";
  if (serverKey) {
    const computedSig = sha512(`${order_id}${status_code}${gross_amount}${serverKey}`);
    if (signature_key && computedSig !== signature_key) {
      console.error(`[midtrans-callback] Signature mismatch: computed=${computedSig} received=${signature_key}`);
      return new Response("Unauthorized", { status: 403 });
    }
    console.log("[midtrans-callback] Signature verified OK");
  } else {
    console.warn("[midtrans-callback] MIDTRANS_SERVER_KEY not set — skipping signature verification");
  }

  const mappedPaymentType = mapPaymentType(payment_type);
  const client = getClient();

  if (!client) {
    console.warn("[midtrans-callback] Supabase not configured — cannot update DB");
    return new Response("OK", { status: 200 });
  }

  if (["expire", "cancel", "deny", "failure"].includes(transaction_status)) {
    console.log(`[midtrans-callback] Payment failed (${transaction_status}) — setting status='failed' for ${order_id}`);

    await client
      .from("transactions")
      .update({ status: "failed", payment_method: mappedPaymentType })
      .eq("invoice_id", order_id);

    return new Response("OK", { status: 200 });
  }

  const isSettlement       = transaction_status === "settlement";
  const isAcceptedCapture  = transaction_status === "capture" && fraud_status === "accept";
  const isPaid             = isSettlement || isAcceptedCapture;

  if (!isPaid) {
    const mappedStatus = mapStatus(transaction_status, fraud_status);
    console.log(`[midtrans-callback] Non-final status: ${transaction_status} → ${mappedStatus} — recording only`);

    await client
      .from("transactions")
      .update({ status: mappedStatus, payment_method: mappedPaymentType })
      .eq("invoice_id", order_id);

    return new Response("OK", { status: 200 });
  }

  const { data: rows, error: updateError } = await client
    .from("transactions")
    .update({ status: "success", payment_method: mappedPaymentType })
    .eq("invoice_id", order_id)
    .select("invoice_id, product_id, player_id, game_slug, denomination_label, status");

  if (updateError) {
    console.error("[midtrans-callback] DB update error:", updateError);
    await logError(client, {
      actionType: "MIDTRANS_CALLBACK",
      errorMessage: String(updateError.message),
      rawResponse: { order_id, transaction_status, fraud_status, payment_type },
    });
    return new Response("OK", { status: 200 });
  }

  const updatedRows = rows as Array<{
    invoice_id: string;
    product_id: string;
    player_id: string;
    game_slug: string | null;
    denomination_label: string | null;
    status: string;
  }> | null;

  console.log(`[midtrans-callback] Paid — Updated ${updatedRows?.length ?? 0} row(s) for order_id=${order_id}`);

  if (updatedRows && updatedRows.length > 0) {
    const tx = updatedRows[0];
    console.log("[midtrans-callback] Triggering Digiflazz top-up for:", tx.invoice_id);

    const digiResult = await triggerDigiflazzTopup({
      invoice_id: tx.invoice_id,
      product_id: tx.product_id,
      player_id: tx.player_id,
      game_slug: tx.game_slug,
      denomination_label: tx.denomination_label,
    });

    if (digiResult.success) {
      console.log("[midtrans-callback] Digiflazz top-up SUCCESS:", digiResult.message);
    } else {
      console.error("[midtrans-callback] Digiflazz top-up FAILED:", digiResult.message);
      await logError(client, {
        actionType: "DIGIFLAZZ_TOPUP",
        errorMessage: digiResult.message,
        rawResponse: digiResult.rawResponse ?? { invoice_id: order_id },
      });
      await client
        .from("transactions")
        .update({ status: "processing" })
        .eq("invoice_id", order_id);
    }
  }

  return new Response("OK", { status: 200 });
});
