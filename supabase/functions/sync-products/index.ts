import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHash } from "node:crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function md5(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function toSlug(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl          = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey           = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const digiflazzUsername    = Deno.env.get("DIGIFLAZZ_USERNAME") ?? "";
    const digiflazzApiKey      = Deno.env.get("DIGIFLAZZ_API_KEY") ?? "";

    if (!digiflazzUsername || !digiflazzApiKey) {
      return json({ error: "Digiflazz credentials not configured on server" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    console.log("[sync-products] Start — user:", user.email ?? user.id);

    // 1. Fetch Digiflazz pricelist
    const sign = md5(digiflazzUsername + digiflazzApiKey + "pricelist");
    const pricelistResp = await fetch("https://api.digiflazz.com/v1/price-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: digiflazzUsername, sign }),
    });

    const pricelistJson = await pricelistResp.json();
    const pricelist = pricelistJson.data;

    if (!Array.isArray(pricelist)) {
      return json({ error: "Digiflazz API error", detail: pricelistJson }, 502);
    }

    console.log("[sync-products] Pricelist fetched:", pricelist.length, "items");

    // 2. Load categories with mapping
    const { data: categories, error: catError } = await supabase
      .from("categories")
      .select("id, slug, name, digiflazz_category, markup_percent, platform")
      .not("digiflazz_category", "is", null);

    if (catError) {
      return json({ error: "Failed to load categories", detail: catError.message }, 500);
    }

    const mappedCategories = (categories ?? []).filter(
      (c: any) => c.digiflazz_category?.trim()
    );

    console.log("[sync-products] Mapped categories:", mappedCategories.length);

    // 3. Get existing products by digiflazz_sku for matching
    const { data: existingProducts } = await supabase
      .from("products")
      .select("id, digiflazz_sku, cost_price, selling_price");

    const existingBySku = new Map<string, any>();
    for (const p of existingProducts ?? []) {
      if (p.digiflazz_sku) existingBySku.set(p.digiflazz_sku, p);
    }

    let created = 0;
    let updated = 0;
    let unchanged = 0;
    const errors: string[] = [];
    const processedSkus = new Set<string>();

    // 4. Process each category
    for (const cat of mappedCategories) {
      const markupPct = Number(cat.markup_percent ?? 20);
      const digiCategory = cat.digiflazz_category.trim();

      const digiItems = pricelist.filter(
        (item: any) =>
          item.brand?.toLowerCase() === digiCategory.toLowerCase()
      );

      console.log(`[sync-products] ${cat.slug}: ${digiItems.length} items matching "${digiCategory}"`);

      for (const item of digiItems) {
        const sku: string = item.buyer_sku_code;
        const costPrice: number = item.price;
        const digiName: string = item.product_name;
        const sellingPrice = Math.ceil(costPrice * (1 + markupPct / 100) / 100) * 100;

        processedSkus.add(sku);

        const existing = existingBySku.get(sku);
        if (existing) {
          if (existing.cost_price !== costPrice || existing.selling_price !== sellingPrice) {
            const { error: updateErr } = await supabase
              .from("products")
              .update({ cost_price: costPrice, selling_price: sellingPrice })
              .eq("id", existing.id);

            if (updateErr) {
              errors.push(`Update ${sku}: ${updateErr.message}`);
            } else {
              updated++;
            }
          } else {
            unchanged++;
          }
        } else {
          const baseSlug = `${cat.slug}-${toSlug(digiName)}`;

          const { error: insertErr } = await supabase
            .from("products")
            .insert({
              name: digiName,
              slug: baseSlug,
              category: "game",
              game_category: cat.slug,
              platform: cat.platform ?? "Mobile",
              pricing_mode: "automatic",
              cost_price: costPrice,
              markup_percent: markupPct,
              selling_price: sellingPrice,
              digiflazz_sku: sku,
              is_active: true,
            });

          if (insertErr) {
            errors.push(`Insert ${sku}: ${insertErr.message}`);
          } else {
            created++;
          }
        }
      }
    }

    console.log("[sync-products] Done — created:", created, "updated:", updated, "unchanged:", unchanged, "errors:", errors.length);

    return json({
      success: true,
      created,
      updated,
      unchanged,
      errors: errors.length > 0 ? errors : undefined,
      total: processedSkus.size,
    });
  } catch (err) {
    console.error("[sync-products] Fatal:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
