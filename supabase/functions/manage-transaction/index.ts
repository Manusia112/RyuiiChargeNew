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

// Statuses still in-flight; bulk-delete must NOT touch these.
const PROTECTED_STATUSES = ["pending", "Pending", "menunggu", "Menunggu", "processing", "Processing", "diproses", "Diproses"];

/**
 * Server-side handler for destructive transaction actions.
 *
 * The browser cannot reliably issue UPDATE/DELETE against `transactions`
 * because RLS on the table will silently filter out rows the anon key
 * does not own (the request returns 200 with `data=[]` and NO error,
 * which the user sees as "the action worked" while the row stays in DB).
 *
 * This function uses the service role key (bypasses RLS), but enforces
 * ownership server-side by:
 *   1. Reading the caller's JWT from `Authorization: Bearer <token>`.
 *   2. Resolving the user_id via `auth.getUser`.
 *   3. Filtering every write by `user_id = <resolved id>`.
 *
 * Actions:
 *   { action: "cancel",     transaction_id: "<uuid>" }   → status = "Gagal"
 *   { action: "delete",     transaction_id: "<uuid>" }   → DELETE single row
 *   { action: "delete_all" }                             → DELETE all non-protected rows
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST")    return json({ success: false, message: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey     = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceKey || !anonKey) {
      return json({ success: false, message: "Supabase env not configured" }, 500);
    }

    // ── Auth: resolve user_id from the caller's JWT ─────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const token      = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    if (!token || token === anonKey) {
      return json({ success: false, message: "Login dulu untuk melakukan aksi ini" }, 401);
    }

    // Use anon client just to validate the JWT.
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      console.warn("[manage-transaction] auth.getUser failed:", userError?.message);
      return json({ success: false, message: "Sesi tidak valid, silakan login ulang" }, 401);
    }

    const userId = userData.user.id;

    // Service-role client bypasses RLS — we enforce ownership manually.
    const adminClient = createClient(supabaseUrl, serviceKey);

    // ── Parse body ─────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "").trim();

    if (!action) return json({ success: false, message: "action wajib diisi" }, 400);

    // ── CANCEL ─────────────────────────────────────────────────────────
    if (action === "cancel") {
      const txId = String(body.transaction_id ?? "").trim();
      if (!txId) return json({ success: false, message: "transaction_id wajib diisi" }, 400);

      const { data, error } = await adminClient
        .from("transactions")
        .update({ status: "Gagal" })
        .eq("id", txId)
        .eq("user_id", userId)
        .select("id, invoice_id, status");

      if (error) {
        console.error("[manage-transaction:cancel] DB error:", error.message);
        return json({ success: false, message: "Gagal membatalkan: " + error.message }, 500);
      }
      if (!data || data.length === 0) {
        return json({ success: false, message: "Transaksi tidak ditemukan atau bukan milikmu" }, 404);
      }

      console.log(`[manage-transaction] CANCEL ok: ${data[0].invoice_id} (user=${userId})`);
      return json({ success: true, action: "cancel", row: data[0] });
    }

    // ── DELETE single ──────────────────────────────────────────────────
    if (action === "delete") {
      const txId = String(body.transaction_id ?? "").trim();
      if (!txId) return json({ success: false, message: "transaction_id wajib diisi" }, 400);

      const { data, error } = await adminClient
        .from("transactions")
        .delete()
        .eq("id", txId)
        .eq("user_id", userId)
        .select("id, invoice_id");

      if (error) {
        console.error("[manage-transaction:delete] DB error:", error.message);
        return json({ success: false, message: "Gagal menghapus: " + error.message }, 500);
      }
      if (!data || data.length === 0) {
        return json({ success: false, message: "Transaksi tidak ditemukan atau bukan milikmu" }, 404);
      }

      console.log(`[manage-transaction] DELETE ok: ${data[0].invoice_id} (user=${userId})`);
      return json({ success: true, action: "delete", deleted: data.length });
    }

    // ── DELETE ALL (excluding active rows) ─────────────────────────────
    if (action === "delete_all") {
      const { data, error } = await adminClient
        .from("transactions")
        .delete()
        .eq("user_id", userId)
        .not("status", "in", `(${PROTECTED_STATUSES.map((s) => `"${s}"`).join(",")})`)
        .select("id, invoice_id");

      if (error) {
        console.error("[manage-transaction:delete_all] DB error:", error.message);
        return json({ success: false, message: "Gagal menghapus: " + error.message }, 500);
      }

      console.log(`[manage-transaction] DELETE_ALL ok: ${data?.length ?? 0} rows (user=${userId})`);
      return json({ success: true, action: "delete_all", deleted: data?.length ?? 0 });
    }

    return json({ success: false, message: `Action "${action}" tidak dikenal` }, 400);
  } catch (err) {
    console.error("[manage-transaction] Unexpected:", err);
    return json({ success: false, message: "Server error" }, 500);
  }
});
