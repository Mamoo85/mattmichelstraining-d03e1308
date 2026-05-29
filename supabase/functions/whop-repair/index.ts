// whop-repair — reset all product prices to $4.99 and clean up duplicate plans
// POST /functions/v1/whop-repair
// POST /functions/v1/whop-repair?price=9.99   (override price)

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const WHOP_KEY     = Deno.env.get("WHOP_API_KEY") || "";
const WHOP_COMPANY = Deno.env.get("WHOP_COMPANY_ID") || "";

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const h  = { Authorization: `Bearer ${WHOP_KEY}`, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  const url       = new URL(req.url);
  const newPrice  = parseFloat(url.searchParams.get("price") || "4.99");

  const { data: products, error } = await sb.from("whop_products" as any).select("*").order("id");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const results: Record<string, unknown>[] = [];

  for (const p of products as any[]) {
    const entry: Record<string, unknown> = { id: p.id, title: p.title, whop_id: p.whop_id };

    // 1. List all existing plans for this product
    const listRes = await fetch(`https://api.whop.com/api/v1/plans?product_id=${p.whop_id}`, {
      headers: h, signal: AbortSignal.timeout(10_000),
    });
    const listTxt = await listRes.text();
    let existingPlans: any[] = [];
    if (listRes.ok) {
      const parsed = JSON.parse(listTxt);
      existingPlans = parsed?.data ?? parsed?.plans ?? (Array.isArray(parsed) ? parsed : []);
    }
    entry.existing_plans = existingPlans.map((pl: any) => `${pl.id} @ $${pl.initial_price ?? pl.price ?? "?"}`);

    // 2. Delete all existing plans
    let deleted = 0;
    for (const plan of existingPlans) {
      const delRes = await fetch(`https://api.whop.com/api/v1/plans/${plan.id}`, {
        method: "DELETE", headers: h, signal: AbortSignal.timeout(10_000),
      });
      if (delRes.ok || delRes.status === 404) deleted++;
    }
    entry.deleted = deleted;

    // 3. Create single new plan at target price
    const planRes = await fetch("https://api.whop.com/api/v1/plans", {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        product_id: p.whop_id,
        company_id: WHOP_COMPANY,
        plan_type: "one_time",
        initial_price: newPrice,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const planTxt = await planRes.text();
    if (planRes.ok) {
      const plan = JSON.parse(planTxt);
      entry.new_plan = `${plan.id} @ $${newPrice}`;
      // Update DB
      await sb.from("whop_products" as any).update({ price_cents: Math.round(newPrice * 100) }).eq("whop_id", p.whop_id);
    } else {
      entry.new_plan = `FAILED ${planRes.status}: ${planTxt.slice(0, 150)}`;
    }

    results.push(entry);
  }

  return Response.json({ price: newPrice, total: results.length, results });
});
