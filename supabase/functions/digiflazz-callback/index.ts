import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Constants ────────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Always reply 200 with this body so Digiflazz marks the callback as delivered.
function ack(): Response {
  return new Response(JSON.stringify({ status: "received" }), {
    status:  200,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// ── Supabase helpers ─────────────────────────────────────────────────────────

function getClient() {
  const url = Deno.env.get("SUPABASE_URL")              ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) return null;
  return createClient(url, key);
}

async function logError(
  client: ReturnType<typeof createClient>,
  params: { actionType: string; errorMessage: string; rawResponse: unknown },
) {
  await client.from("error_logs").insert({
    action_type:   params.actionType,
    error_message: params.errorMessage,
    raw_response:  params.rawResponse,
  });
}

// ── Main handler ─────────────────────────────────────────────────────────────
//
// Digiflazz sends a webhook after the top-up injection completes.
// Reference payload (Digiflazz "report" callback):
//   {
//     "data": {
//       "ref_id":      "RYUII-1700000000000-XXXX",
//       "status":      "Sukses" | "Gagal" | "Pending",
//       "message":     "Transaksi sukses",
//       "sn":          "...",
//       "buyer_sku_code": "...",
//       "customer_no":    "...",
//       ...
//     }
//   }

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST")    return new Response("Method Not Allowed", { status: 405 });

  console.log("=== DIGIFLAZZ CALLBACK RECEIVED ===");

  // Read raw body so we can debug malformed payloads.
  const rawText = await req.text();

  let payload: Record<string, unknown> = {};
  try {
    payload = rawText ? JSON.parse(rawText) : {};
  } catch (e) {
    console.warn("[digiflazz-callback] Could not parse JSON:", rawText.slice(0, 200));
    return ack();
  }

  // Digiflazz nests the meaningful fields under `data` — accept either shape.
  const inner =
    (payload.data && typeof payload.data === "object")
      ? (payload.data as Record<string, unknown>)
      : payload;

  const refId   = String(inner.ref_id ?? inner.refId ?? "").trim();
  const status  = String(inner.status ?? "").trim();
  const message = String(inner.message ?? "").trim();
  const sn      = inner.sn ? String(inner.sn).trim() : null;

  console.log(`[digiflazz-callback] ref_id=${refId} status=${status} sn=${sn} message="${message}"`);

  if (!refId) {
    console.warn("[digiflazz-callback] Missing ref_id — ignoring");
    return ack();
  }

  const client = getClient();
  if (!client) {
    console.warn("[digiflazz-callback] Supabase not configured — cannot update DB");
    return ack();
  }

  // ── Map Digiflazz status → internal status ────────────────────────────────
  const statusLower = status.toLowerCase();
  let newStatus: string | null = null;

  if (statusLower === "sukses" || statusLower === "success") {
    newStatus = "Berhasil";
  } else if (statusLower === "gagal" || statusLower === "failed") {
    newStatus = "Gagal";
  } else if (statusLower === "pending") {
    // Intermediate report — leave the row alone, just acknowledge.
    console.log(`[digiflazz-callback] Pending report for ${refId} — no DB change`);
    return ack();
  } else {
    console.warn(`[digiflazz-callback] Unknown status "${status}" for ${refId} — no DB change`);
    return ack();
  }

  // ── Update transactions row by invoice_id (matches our ref_id) ───────────
  // We send `ref_id = invoice_id` to Digiflazz from midtrans-callback, so
  // the same value comes back here. We also fall back to matching by `id`
  // (UUID) in case a future caller starts using the row UUID as ref_id.
  const updatePayload: Record<string, unknown> = { status: newStatus };
  if (sn) updatePayload.serial_number = sn; // best-effort; column is optional

  // Helper: run UPDATE + SELECT to verify rows actually changed.
  async function tryUpdate(column: "invoice_id" | "id") {
    const q = await client
      .from("transactions")
      .update(updatePayload)
      .eq(column, refId)
      .select("id, invoice_id, status");
    return { rows: q.data ?? [], error: q.error };
  }

  // 1st attempt: invoice_id (our normal case)
  let { rows, error: updateError } = await tryUpdate("invoice_id");

  // If the optional `serial_number` column doesn't exist, retry without it.
  if (updateError && /serial_number/i.test(updateError.message)) {
    console.warn("[digiflazz-callback] serial_number column missing — retrying without it");
    delete updatePayload.serial_number;
    const retry = await tryUpdate("invoice_id");
    rows        = retry.rows;
    updateError = retry.error;
  }

  // Fallback: match by id (UUID) if invoice_id matched 0 rows
  if (!updateError && rows.length === 0) {
    console.warn(`[digiflazz-callback] 0 rows matched invoice_id="${refId}" — trying id (UUID) match`);
    const fallback = await tryUpdate("id");
    rows        = fallback.rows;
    updateError = fallback.error;
  }

  if (updateError) {
    console.error("[digiflazz-callback] DB update error:", updateError);
    await logError(client, {
      actionType:   "DIGIFLAZZ_CALLBACK",
      errorMessage: String(updateError.message),
      rawResponse:  payload,
    });
    // Still 200 so Digiflazz stops retrying.
    return ack();
  }

  if (rows.length === 0) {
    // Row genuinely doesn't exist (or was deleted). Log so admin can audit.
    console.error(`[digiflazz-callback] No matching row for ref_id="${refId}"`);
    await logError(client, {
      actionType:   "DIGIFLAZZ_CALLBACK_NO_MATCH",
      errorMessage: `No transactions row matched ref_id=${refId}`,
      rawResponse:  payload,
    });
    return ack();
  }

  console.log(`[digiflazz-callback] Updated ${rows.length} row(s) for ref_id=${refId} → status='${newStatus}'`);

  // Persist the failure reason so admin can review later.
  if (newStatus === "Gagal") {
    await logError(client, {
      actionType:   "DIGIFLAZZ_TOPUP_REPORT",
      errorMessage: message || "Digiflazz reported Gagal",
      rawResponse:  payload,
    });
  }

  return ack();
});
