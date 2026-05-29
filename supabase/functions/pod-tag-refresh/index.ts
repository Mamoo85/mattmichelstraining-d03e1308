// pod-tag-refresh v1 — weekly tag freshness refresh for 10 published Printify products
// Cron: 0 7 * * 1 (Mondays 7am UTC)
// POST {"offset":N} — processes 10 products starting at offset N
// Returns {processed, updated, nextOffset}
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRINTIFY_KEY = Deno.env.get("PRINTIFY_API_KEY") ?? "";
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const SHOP_ID = Deno.env.get("PRINTIFY_SHOP_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

async function pFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  return fetch(`https://api.printify.com/v1${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${PRINTIFY_KEY}`,
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const offset = Number(body.offset ?? 0);
    const page = Math.floor(offset / 10) + 1;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const listRes = await pFetch(`/shops/${SHOP_ID}/products.json?page=${page}&limit=10`);
    if (!listRes.ok) throw new Error(`Printify list ${listRes.status}`);
    const listData = await listRes.json() as { data: Array<{ id: string; title: string; tags?: string[]; external?: { id?: string } }> };
    const products = (listData.data ?? []).filter(p => p.external?.id);

    let processed = 0, updated = 0;
    const now = new Date();
    const monthYear = `${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}`;
    const auditLogs: Array<Record<string, unknown>> = [];

    for (const prod of products) {
      processed++;
      const oldTags = prod.tags ?? [];
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `It is ${monthYear}. Return JSON array of exactly 13 Etsy search tags for this POD product.`,
              },
              {
                role: "user",
                content: `Title: "${prod.title.slice(0, 120)}". Current tags: ${JSON.stringify(oldTags)}. Rules: max 20 chars each, real buyer search phrases, seasonal terms if relevant. Return JSON: {"tags":["t1","t2",...]}`,
              },
            ],
            temperature: 0.6,
            response_format: { type: "json_object" },
          }),
          signal: AbortSignal.timeout(25_000),
        });
        if (!res.ok) { console.warn(`OpenAI ${res.status} for ${prod.id}`); continue; }
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(content);
        const newTags = ((parsed.tags ?? []) as string[])
          .map((t: string) => t.replace(/[^a-zA-Z0-9 \-]/g, "").trim().slice(0, 20).trim())
          .filter((t: string) => t.length > 0)
          .slice(0, 13);

        if (newTags.length < 13) { console.warn(`Only got ${newTags.length} tags for ${prod.id}`); continue; }

        await pFetch(`/shops/${SHOP_ID}/products/${prod.id}.json`, {
          method: "PUT",
          body: JSON.stringify({ tags: newTags }),
        });
        await new Promise((r) => setTimeout(r, 1_000));
        await pFetch(`/shops/${SHOP_ID}/products/${prod.id}/publish.json`, {
          method: "POST",
          body: JSON.stringify({ tags: true, shipping_template: false }),
        });

        auditLogs.push({
          product_id: prod.id,
          product_title: prod.title,
          issues: ["tag_refresh"],
          actions_taken: ["tags_updated", "republished"],
        });
        updated++;
        await new Promise((r) => setTimeout(r, 1_000));
      } catch (e) {
        console.warn(`Tag refresh failed ${prod.id}: ${(e as Error).message.slice(0, 100)}`);
      }
    }

    if (auditLogs.length > 0) {
      await supabase.from("pod_audit_log").insert(auditLogs.map(l => ({
        product_id: l.product_id,
        product_title: l.product_title,
        issues: l.issues,
        actions_taken: l.actions_taken,
      })));
    }

    const nextOffset = products.length >= 10 ? offset + 10 : null;
    return new Response(JSON.stringify({ processed, updated, nextOffset }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("pod-tag-refresh error:", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
