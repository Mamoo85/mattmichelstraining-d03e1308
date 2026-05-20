// Resume the in-flight republish pass: finds pod_listings still on the old
// prompt/dims (republished_at IS NULL AND status='published'), and invokes
// pod-republish-wrong-dims in batches until the queue drains.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BATCH_SIZE = 10;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const limit = Math.min(Number(body.limit ?? BATCH_SIZE), 50);
    const dryRun = Boolean(body.dry_run);

    // Pick listings still on the old pipeline.
    const { data: pending, error } = await sb
      .from("pod_listings")
      .select("id, printify_id, product_type, republished_at, status")
      .is("republished_at", null)
      .eq("status", "published")
      .order("published_at", { ascending: true })
      .limit(limit);
    if (error) throw error;

    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ ok: true, queue_empty: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (dryRun) {
      return new Response(JSON.stringify({ ok: true, dry_run: true, would_process: pending.length, ids: pending.map((r) => r.id) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delegate to the canonical republish-wrong-dims function (it has the full pipeline).
    const r = await fetch(`${SUPABASE_URL}/functions/v1/pod-republish-wrong-dims`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({
        listing_ids: pending.map((r) => r.id),
        limit: pending.length,
      }),
    });
    const txt = await r.text();
    const payload = (() => { try { return JSON.parse(txt); } catch { return { raw: txt }; } })();

    return new Response(JSON.stringify({
      ok: r.ok,
      processed: pending.length,
      republish_response: payload,
      remaining_queue_hint: pending.length === limit ? "more_likely" : "drained_or_near",
    }), {
      status: r.ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
