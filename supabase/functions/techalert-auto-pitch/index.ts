// techalert-auto-pitch — Scans hire_alert_clients for accounts with 3+ open
// healthcare/tech roles and drafts a role-specific TechAlert pitch via Claude
// Haiku into outreach_approval_queue. Matt approves once, batch fires.
//
// Idempotency: idempotency_key = `techalert-pitch-${client.id}-${role_hash}`.
// Same role mix won't re-draft.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateWithHaiku } from "../_shared/opus.ts";
import { logError } from "../_shared/error-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ROLE_THRESHOLD = 3;

async function hash(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const d = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(d)).slice(0, 6).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Find candidates per client (employer aggregation)
    // We use hire_alert_candidates aggregated by current_employer to find hot hiring accounts.
    const { data: cands, error } = await sb
      .from("hire_alert_candidates")
      .select("current_employer, current_title, trade, license_type, city, state, full_name, name")
      .not("current_employer", "is", null)
      .gte("first_seen_at", new Date(Date.now() - 30 * 86400_000).toISOString())
      .limit(2000);
    if (error) throw error;

    // Group by employer
    const byEmployer = new Map<string, Array<any>>();
    for (const c of cands || []) {
      const emp = (c.current_employer || "").trim();
      if (!emp || emp.length < 3) continue;
      if (!byEmployer.has(emp)) byEmployer.set(emp, []);
      byEmployer.get(emp)!.push(c);
    }

    const candidates = Array.from(byEmployer.entries())
      .filter(([_, list]) => list.length >= ROLE_THRESHOLD)
      .slice(0, 25); // safety cap

    let drafted = 0;
    let skipped = 0;
    const results: Array<Record<string, unknown>> = [];

    for (const [employer, list] of candidates) {
      const roles = Array.from(new Set(list.map((l) => l.current_title || l.trade).filter(Boolean))).slice(0, 6);
      const accountKey = `employer:${employer.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`;
      const roleHash = await hash(roles.sort().join("|"));
      const idem = `techalert-pitch-${accountKey}-${roleHash}`;

      // Skip if already queued for this role mix
      const { data: existing } = await sb
        .from("outreach_approval_queue")
        .select("id")
        .eq("idempotency_key", idem)
        .maybeSingle();
      if (existing) { skipped++; continue; }

      const city = list[0]?.city || "";
      const state = list[0]?.state || "MI";
      const isHealthcare = list.some((l) => /\b(rn|lpn|cna|nurse|nursing|home health)\b/i.test(`${l.trade} ${l.license_type}`));
      const product = isHealthcare ? "HireAlert Healthcare" : "TechAlert";

      const prompt = `Write a cold email to the hiring manager at ${employer} (${city}, ${state}). They have ${list.length} open roles I detected: ${roles.join(", ")}. Pitch ${product} — we surface licensed ${isHealthcare ? "healthcare professionals (RN/LPN/CNA)" : "technicians"} the moment their license is issued or renewed in their ZIP. Most show up on our radar within 48h of becoming available. Tone: founder-direct, mention 1 specific role from the list. 4 sentences max. End with: "Want me to send you 3 sample profiles for the ${roles[0]} opening?"`;

      const body = await generateWithHaiku(
        prompt,
        "You are Matt Michels, founder of Detroit Web Agency. Write like a coach texting a friend. No corporate fluff. No exclamation points.",
        500,
      ).catch(() => "");

      if (!body || body.length < 80) {
        results.push({ employer, status: "ai_failed" });
        continue;
      }

      const subject = `${roles[0]} opening at ${employer.split(/\s+/).slice(0, 3).join(" ")}?`.slice(0, 100);

      const { error: qErr } = await sb.from("outreach_approval_queue").insert({
        source_function: "techalert-auto-pitch",
        channel: "email",
        account_key: accountKey,
        account_name: employer,
        account_vertical: isHealthcare ? "healthcare" : "field_service",
        account_location: `${city}, ${state}`.replace(/^,\s*/, ""),
        draft_subject: subject,
        draft_body: body,
        signal_reason: `${list.length} open roles detected: ${roles.slice(0, 3).join(", ")}`,
        signal_payload: { employer, roles, candidate_count: list.length, product },
        confidence_score: Math.min(0.95, 0.5 + list.length * 0.08),
        idempotency_key: idem,
      });
      if (qErr) {
        if ((qErr as any).code === "23505") { skipped++; continue; }
        throw qErr;
      }
      drafted++;
      results.push({ employer, roles: roles.length, candidates: list.length });
    }

    return new Response(JSON.stringify({ ok: true, eligible_employers: candidates.length, drafted, skipped, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[techalert-auto-pitch] FAIL:", msg);
    await logError({ source: "edge_function", function_name: "techalert-auto-pitch", severity: "error", error_message: msg }).catch(() => {});
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
