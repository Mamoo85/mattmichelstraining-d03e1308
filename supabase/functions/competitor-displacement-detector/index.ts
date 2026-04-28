// competitor-displacement-detector — Scans recent candidate records for
// mentions of competing platforms (ServiceTitan, Jobber, HouseCallPro, etc.)
// in their qualifications_summary or current_title, logs to competitor_mentions,
// and drafts a displacement pitch into outreach_approval_queue.
//
// "You're scaling off [Competitor] — here's why contractors are switching."

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateWithHaiku } from "../_shared/opus.ts";
import { logError } from "../_shared/error-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Map of competitor keyword -> our pitch product
const COMPETITORS: Array<{ name: string; pattern: RegExp; pitch_product: string; angle: string }> = [
  { name: "ServiceTitan", pattern: /\bservice ?titan\b/i, pitch_product: "FieldDesk", angle: "1/4 the price, no per-tech fees, owns the data" },
  { name: "Jobber", pattern: /\bjobber\b/i, pitch_product: "FieldDesk", angle: "no usage caps, no extra fees for QuickBooks sync, AI dispatch built in" },
  { name: "Housecall Pro", pattern: /\bhousecall(\s+pro)?\b/i, pitch_product: "FieldDesk", angle: "no per-user pricing, native missed-call recovery, true offline mode" },
  { name: "Salesforce", pattern: /\bsalesforce\b/i, pitch_product: "FieldDesk + Lead Marketplace", angle: "purpose-built for trades, no consultant army needed, $199/mo flat" },
  { name: "Angi Leads", pattern: /\bangi\s*(leads)?\b|\bangie['']?s?\s*list\b/i, pitch_product: "Contractor Lead Marketplace", angle: "exclusive leads, no shared-with-5-others, money-back if not contacted in 60s" },
  { name: "HomeAdvisor", pattern: /\bhome\s*advisor\b/i, pitch_product: "Contractor Lead Marketplace", angle: "real homeowner intent, instant SMS dispatch, transparent per-lead pricing" },
  { name: "Indeed", pattern: /\bindeed\b/i, pitch_product: "TechAlert", angle: "we surface licensed techs the moment their license posts — before they hit Indeed" },
  { name: "ZipRecruiter", pattern: /\bzip\s*recruiter\b/i, pitch_product: "TechAlert", angle: "zero applicant noise — only verified-licensed techs in your ZIP" },
];

async function hash(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const d = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(d)).slice(0, 6).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Pull recent candidates with text fields likely to mention competitors
    const since = new Date(Date.now() - 14 * 86400_000).toISOString();
    const { data: rows, error } = await sb
      .from("hire_alert_candidates")
      .select("id, full_name, name, current_employer, current_title, trade, qualifications_summary, city, state")
      .gte("first_seen_at", since)
      .not("current_employer", "is", null)
      .limit(1500);
    if (error) throw error;

    let detected = 0;
    let drafted = 0;
    let skipped = 0;
    const results: Array<Record<string, unknown>> = [];

    // Aggregate detections by employer (one pitch per employer)
    const employerHits = new Map<string, { employer: string; competitor: string; angle: string; product: string; city: string; state: string; sample_titles: Set<string>; candidate_ids: string[] }>();

    for (const r of rows || []) {
      const haystack = `${r.qualifications_summary || ""} ${r.current_title || ""} ${r.trade || ""}`;
      for (const comp of COMPETITORS) {
        if (!comp.pattern.test(haystack)) continue;
        detected++;
        await sb.from("competitor_mentions").insert({
          candidate_id: r.id,
          source: "candidate_profile",
          competitor_name: comp.name,
          context_snippet: haystack.slice(0, 400),
        }).catch(() => {});

        const empKey = `${(r.current_employer || "unknown").toLowerCase()}|${comp.name}`;
        if (!employerHits.has(empKey)) {
          employerHits.set(empKey, {
            employer: r.current_employer!,
            competitor: comp.name,
            angle: comp.angle,
            product: comp.pitch_product,
            city: r.city || "",
            state: r.state || "MI",
            sample_titles: new Set(),
            candidate_ids: [],
          });
        }
        const hit = employerHits.get(empKey)!;
        if (r.current_title) hit.sample_titles.add(r.current_title);
        hit.candidate_ids.push(r.id);
        break; // one competitor per candidate
      }
    }

    // Draft one queue entry per (employer, competitor) pair
    for (const hit of employerHits.values()) {
      const accountKey = `employer:${hit.employer.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`;
      const idem = `displacement-${accountKey}-${hit.competitor.toLowerCase()}-${await hash(Array.from(hit.sample_titles).sort().join("|"))}`;

      const { data: existing } = await sb
        .from("outreach_approval_queue")
        .select("id")
        .eq("idempotency_key", idem)
        .maybeSingle();
      if (existing) { skipped++; continue; }

      const titles = Array.from(hit.sample_titles).slice(0, 3);
      const prompt = `Write a cold email to the owner of ${hit.employer} (${hit.city}, ${hit.state}). Their team mentions ${hit.competitor} in ${hit.candidate_ids.length} job postings/profiles (sample roles: ${titles.join(", ") || "various"}). Pitch ${hit.product} as the displacement: ${hit.angle}. Tone: founder-direct, name ${hit.competitor} once, lead with the specific pain it causes. 4 sentences max. End with: "Worth a 10-min call to see what switching looks like?"`;

      const body = await generateWithHaiku(
        prompt,
        "You are Matt Michels, founder of Detroit Web Agency. Write like a coach texting a friend. No corporate speak. No exclamation points.",
        500,
      ).catch(() => "");

      if (!body || body.length < 80) {
        results.push({ employer: hit.employer, competitor: hit.competitor, status: "ai_failed" });
        continue;
      }

      const subject = `${hit.employer.split(/\s+/).slice(0, 3).join(" ")} → ${hit.competitor.split(" ")[0]} feedback`.slice(0, 100);

      const { data: queued, error: qErr } = await sb.from("outreach_approval_queue").insert({
        source_function: "competitor-displacement-detector",
        channel: "email",
        account_key: accountKey,
        account_name: hit.employer,
        account_location: `${hit.city}, ${hit.state}`.replace(/^,\s*/, ""),
        draft_subject: subject,
        draft_body: body,
        signal_reason: `${hit.candidate_ids.length} mention(s) of ${hit.competitor} in team`,
        signal_payload: { competitor: hit.competitor, product: hit.product, angle: hit.angle, sample_titles: titles, candidate_count: hit.candidate_ids.length },
        confidence_score: Math.min(0.9, 0.6 + hit.candidate_ids.length * 0.05),
        idempotency_key: idem,
      }).select("id").single();
      if (qErr) {
        if ((qErr as any).code === "23505") { skipped++; continue; }
        throw qErr;
      }

      // Mark mentions as acted_on
      await sb.from("competitor_mentions")
        .update({ acted_on: true, acted_at: new Date().toISOString(), approval_queue_id: queued.id })
        .in("candidate_id", hit.candidate_ids)
        .eq("competitor_name", hit.competitor);

      drafted++;
      results.push({ employer: hit.employer, competitor: hit.competitor, mentions: hit.candidate_ids.length });
    }

    return new Response(JSON.stringify({ ok: true, scanned: rows?.length || 0, detected, drafted, skipped, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[competitor-displacement-detector] FAIL:", msg);
    await logError({ source: "edge_function", function_name: "competitor-displacement-detector", severity: "error", error_message: msg }).catch(() => {});
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
