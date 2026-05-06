// techalert-hot-candidate-notify — every 2 hours
// When a hire_alert_candidate reaches Score ≥ 9, SMS every active TechAlert
// client whose target_roles overlap the candidate's trade.
// Sets hot_notified_at so the candidate is never double-texted.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const HOT_SCORE_THRESHOLD = 9;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalize a trade string for loose matching against target_roles array
function tradeTokens(trade: string): string[] {
  return trade.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
}

function rolesMatchTrade(targetRoles: string[] | null, candidateTrade: string | null): boolean {
  if (!targetRoles?.length || !candidateTrade) return true; // no filter = accept all
  const tokens = tradeTokens(candidateTrade);
  return targetRoles.some((role) => {
    const roleTokens = tradeTokens(role);
    return tokens.some((t) => roleTokens.some((r) => r.includes(t) || t.includes(r)));
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startedAt = Date.now();
  let notified = 0, skipped = 0;

  try {
    // Pull Score ≥ 9 candidates not yet hot-notified
    const { data: hotCandidates, error } = await sb
      .from("hire_alert_candidates")
      .select("id, name, trade, city, state, score, phone, email, license_type, years_experience")
      .gte("score", HOT_SCORE_THRESHOLD)
      .is("hot_notified_at", null)
      .eq("do_not_contact", false)
      .order("score", { ascending: false })
      .limit(20);

    if (error) throw error;
    if (!hotCandidates?.length) {
      return new Response(
        JSON.stringify({ ok: true, notified: 0, note: "no hot candidates pending notification" }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Pull active clients who want SMS alerts
    const { data: clients } = await sb
      .from("hire_alert_clients")
      .select("id, company_name, owner_phone, target_roles, target_metro, target_state, notify_sms")
      .eq("active", true)
      .eq("notify_sms", true)
      .not("owner_phone", "is", null);

    const activeClients = clients || [];

    for (const candidate of hotCandidates) {
      const trade = candidate.trade || candidate.license_type || "trades professional";
      const city = candidate.city || "your area";
      const stateLabel = candidate.state || "MI";
      const scoreLabel = candidate.score || HOT_SCORE_THRESHOLD;

      // Match clients: trade overlap + (optional) state match
      const matchingClients = activeClients.filter((c) => {
        const tradeOk = rolesMatchTrade(c.target_roles, trade);
        const stateOk = !c.target_state || c.target_state === stateLabel;
        return tradeOk && stateOk;
      });

      let clientsTexted = 0;
      for (const client of matchingClients) {
        const body = `🔥 Hot candidate alert — Score ${scoreLabel}/10\n${trade} in ${city}, ${stateLabel}. View full profile + contact info in your TechAlert dashboard. — Matt, Detroit Web Agency\nReply STOP to opt out`;
        const result = await sendSMS({ to: client.owner_phone, body, force: false });
        if ((result as any)?.success) clientsTexted++;
        await new Promise((r) => setTimeout(r, 200));
      }

      // Mark notified regardless (prevents re-alert even if 0 clients matched)
      await sb
        .from("hire_alert_candidates")
        .update({ hot_notified_at: new Date().toISOString() })
        .eq("id", candidate.id);

      if (clientsTexted > 0) notified++;
      else skipped++;
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "techalert-hot-candidate-notify",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: { notified, skipped, candidates_processed: hotCandidates.length, duration_ms: Date.now() - startedAt },
    }, { onConflict: "agent_name" });

    return new Response(
      JSON.stringify({ ok: true, notified, skipped, candidates_processed: hotCandidates.length, duration_ms: Date.now() - startedAt }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
