// Refresh urgency_score (recency decay) on all candidates from last 45 days.
// Item #23. READ-ONLY against base score; writes only to NEW urgency_score column.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { computeUrgencyScore, readinessWindow } from "../_shared/recency-decay.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  let updated = 0;
  try {
    const { data: candidates, error } = await sb
      .from("hire_alert_candidates")
      .select("id, score, first_seen_at")
      .gte("first_seen_at", new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString())
      .not("score", "is", null)
      .limit(2000);

    if (error) throw error;

    for (const c of candidates ?? []) {
      const urgency = computeUrgencyScore(c.score ?? 0, c.first_seen_at);
      const w = readinessWindow(c.first_seen_at);
      const availableUntil = new Date(Date.now() + w.to * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const { error: uErr } = await sb
        .from("hire_alert_candidates")
        .update({ urgency_score: urgency, available_until: availableUntil })
        .eq("id", c.id);
      if (!uErr) updated++;
    }

    return new Response(JSON.stringify({ ok: true, updated }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
