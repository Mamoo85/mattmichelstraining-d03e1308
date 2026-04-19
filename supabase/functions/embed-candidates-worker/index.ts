// Embedding population worker (E42).
// Reads candidates with NULL embedding, generates 768-dim vectors via Lovable AI Gateway
// (google/text-embedding-004), and writes them back. Runs every 5 min via cron.
// Also refreshes search_vector via DB trigger when row is updated.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const MODEL = "google/text-embedding-004";
const BATCH = 25;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toPgVector(v: number[]): string {
  return `[${v.join(",")}]`;
}

async function embed(text: string): Promise<number[] | null> {
  try {
    const r = await fetch(EMBED_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, input: text.slice(0, 2000) }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const v = j?.data?.[0]?.embedding;
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function buildText(c: Record<string, unknown>): string {
  const parts = [
    c.name,
    c.current_title,
    c.trade,
    c.current_employer,
    c.city,
    c.state,
    c.flight_risk_proof,
  ].filter((x) => x && typeof x === "string");
  return parts.join(" | ");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { data: rows, error } = await sb
      .from("hire_alert_candidates")
      .select("id, name, current_title, trade, current_employer, city, state, flight_risk_proof")
      .is("embedding", null)
      .not("name", "is", null)
      .order("first_seen_at", { ascending: false })
      .limit(BATCH);

    if (error) throw new Error(error.message ?? JSON.stringify(error));

    let embedded = 0;
    let skipped = 0;

    for (const c of rows ?? []) {
      const text = buildText(c as Record<string, unknown>);
      if (!text || text.length < 8) { skipped++; continue; }
      const vec = await embed(text);
      if (!vec) { skipped++; continue; }
      const { error: upErr } = await sb
        .from("hire_alert_candidates")
        .update({ embedding: toPgVector(vec) })
        .eq("id", c.id);
      if (upErr) skipped++;
      else embedded++;
    }

    return new Response(
      JSON.stringify({ ok: true, processed: rows?.length ?? 0, embedded, skipped }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : (typeof e === "object" ? JSON.stringify(e) : String(e));
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
