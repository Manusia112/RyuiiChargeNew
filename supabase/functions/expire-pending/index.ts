import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) {
    console.warn("[expire-pending] Supabase not configured");
    return new Response("OK", { status: 200 });
  }

  const client = createClient(url, key);
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data, error } = await client
    .from("transactions")
    .update({ status: "failed" })
    .eq("status", "pending")
    .lt("created_at", thirtyMinAgo)
    .select("invoice_id");

  if (error) {
    console.error("[expire-pending] Error:", error);
    return new Response("OK", { status: 200 });
  }

  console.log(`[expire-pending] Expired ${data?.length ?? 0} pending transactions`);
  return new Response("OK", { status: 200 });
});
