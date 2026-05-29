/**
 * ebay-batch-lister
 * Drains the pod_product_queue: for every published product without an eBay listing,
 * calls ebay-lister in physical mode. Handles its own rate-limit pacing.
 *
 * Also triggers pod-new-products multiple times to push pending→published→eBay.
 *
 * POST {"mode":"list_published"}  — list all published items that aren't on eBay yet
 * POST {"mode":"drain_pending", "rounds":10} — fire pod-new-products N times (60s gap each)
 * POST {"mode":"full"} — list published first, then drain 10 rounds of pending
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const FUNC_BASE    = SUPABASE_URL.replace(".supabase.co", ".supabase.co/functions/v1");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function callFunction(name: string, body: object): Promise<object> {
  const res = await fetch(`${FUNC_BASE}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({ error: `HTTP ${res.status}` }));
}

async function listAllPublished(): Promise<object> {
  // How many unlisted physical products do we have?
  const { count } = await supabase
    .from("pod_product_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .not("product_type", "in", '("download","digital")')
    .is("ebay_item_id", null)
    .not("printify_id", "is", null);

  if (!count) return { message: "All published physical products already listed on eBay" };

  let totalCreated = 0;
  let rounds = 0;
  const batchSize = 20;

  // Keep running physical mode until nothing left
  while (rounds < 20) {
    const result: any = await callFunction("ebay-lister", { mode: "physical", limit: batchSize });
    const created = result?.created ?? 0;
    totalCreated += created;
    rounds++;

    if (created === 0) break; // nothing left to list
    await new Promise(r => setTimeout(r, 2000)); // brief pause between batches
  }

  return { total_listed: totalCreated, rounds };
}

async function drainPending(rounds: number): Promise<object> {
  const results = [];
  for (let i = 0; i < rounds; i++) {
    const result: any = await callFunction("pod-new-products", { mode: "process" });
    results.push({
      round: i + 1,
      result: result?.message ?? result?.created ?? result?.error ?? "done",
    });

    if (i < rounds - 1) {
      // 65-second gap to respect Printify catalog rate limits
      await new Promise(r => setTimeout(r, 65_000));
    }
  }
  return { rounds_fired: rounds, results };
}

Deno.serve(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const mode: string = body.mode ?? "list_published";
  const rounds: number = body.rounds ?? 10;

  try {
    if (mode === "list_published") {
      const result = await listAllPublished();
      return new Response(JSON.stringify(result, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (mode === "drain_pending") {
      const result = await drainPending(rounds);
      return new Response(JSON.stringify(result, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (mode === "full") {
      const listed = await listAllPublished();
      const drained = await drainPending(rounds);
      // After draining, list whatever just got published
      await new Promise(r => setTimeout(r, 5_000));
      const listedNew = await listAllPublished();
      return new Response(JSON.stringify({ listed_existing: listed, drained, listed_new: listedNew }, null, 2), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown mode. Use: list_published | drain_pending | full" }), { status: 400 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
