/**
 * score-prospects — Computes lead_score (0-100) for prospect_pool rows.
 *
 * POST { prospect_ids?: string[], audience_type?, county?, limit? }
 *   - If prospect_ids: score that exact set
 *   - Else: score most recent unscored rows (capped at limit, default 200)
 *
 * Scoring (matches plan):
 *   +25  CMS staffing rating 1-2 stars (nursing home pain)
 *   +20  Active job postings detected
 *   +15  Demand Radar signal in their county
 *   +15  Recent license / federal contract activity
 *   +10  Verified mailable address
 *   +10  Verified fax (when channel_hint includes fax)
 *   +5   Phone listed
 *   +5   Outdated website (Firecrawl optional, skipped here)
 *   -100 In suppressed_emails or fax_opt_outs (suppress entirely)
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runEmailWaterfall, WaterfallCounters } from "../_shared/email-waterfall.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const enrichFirst: boolean = !!body.enrich_first;

    // Pull rows to score
    let q = sb.from("prospect_pool").select("*");
    if (body.prospect_ids?.length) q = q.in("id", body.prospect_ids);
    else {
      if (body.audience_type) q = q.eq("audience_type", body.audience_type);
      if (body.county) q = q.eq("county", body.county);
      // When enrich_first, also pick up rows that have been scored but lack contact info
      if (enrichFirst) q = q.or("scored_at.is.null,email.is.null");
      else q = q.is("scored_at", null);
      q = q.order("created_at", { ascending: false }).limit(body.limit || 200);
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, scored: 0, enriched: 0, counters: {} }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Enrich-first pass: fill missing emails via shared waterfall ─────────
    const counters: WaterfallCounters = {};
    let enrichedCount = 0;
    if (enrichFirst) {
      for (const r of rows as any[]) {
        if (r.email) continue;
        try {
          const wf = await runEmailWaterfall(sb, {
            website: r.website,
            business_name: r.business_name,
            city: r.city,
            state: r.state,
            contact_first_name: r.contact_first_name ?? null,
            contact_last_name: r.contact_last_name ?? null,
          }, counters);
          if (wf.email) {
            const existingMeta = (r.meta && typeof r.meta === "object") ? r.meta : {};
            const existingTrace = Array.isArray((existingMeta as any).enrichment_trace) ? (existingMeta as any).enrichment_trace : [];
            const newMeta = {
              ...existingMeta,
              enrichment_trace: [
                ...existingTrace,
                { ts: new Date().toISOString(), flow: "score_with_enrich", winner: wf.source, confidence: wf.confidence, steps: wf.trace, filled: ["email"] },
              ],
            };
            await sb.from("prospect_pool").update({
              email: wf.email,
              meta: newMeta,
              last_enriched_at: new Date().toISOString(),
            }).eq("id", r.id);
            r.email = wf.email; // mutate so scoring sees it
            r.meta = newMeta;
            enrichedCount++;
          }
        } catch (e) {
          console.warn(`[score-prospects] enrich failed for ${r.id}:`, e);
        }
      }
    }

    // Pull supporting signals once
    const counties = [...new Set(rows.map((r: any) => r.county).filter(Boolean))];
    let demandSignals: any[] = [];
    if (counties.length > 0) {
      const { data: sigs } = await sb
        .from("industry_pulse_signals" as any)
        .select("location, city, county, confidence")
        .gte("confidence", 6)
        .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString());
      demandSignals = (sigs as any[]) || [];
    }

    // Suppression lists (best-effort — tables may exist or not)
    const suppressedFax = new Set<string>();
    const suppressedEmail = new Set<string>();
    try {
      const { data: f } = await sb.from("fax_opt_outs" as any).select("fax_number");
      (f as any[] || []).forEach((r) => r.fax_number && suppressedFax.add(r.fax_number));
    } catch (_e) { /* table may not exist */ }
    try {
      const { data: s } = await sb.from("suppressed_emails" as any).select("email");
      (s as any[] || []).forEach((r) => r.email && suppressedEmail.add(r.email.toLowerCase()));
    } catch (_e) { /* table may not exist */ }


    let scoredCount = 0;
    for (const r of rows as any[]) {
      let score = 0;
      const breakdown: Record<string, number> = {};
      const intel: string[] = [];

      // Suppression — kill switch
      const isSuppressed =
        (r.fax_number && suppressedFax.has(r.fax_number)) ||
        (r.email && suppressedEmail.has(r.email.toLowerCase()));
      if (isSuppressed) {
        await sb.from("prospect_pool").update({
          lead_score: 0,
          score_breakdown: { suppressed: -100 },
          status: "suppressed",
          scored_at: new Date().toISOString(),
        }).eq("id", r.id);
        continue;
      }

      // CMS staffing rating
      if (r.cms_staffing_rating && r.cms_staffing_rating <= 2) {
        score += 25; breakdown.cms_low_staffing = 25;
        intel.push(`${r.cms_staffing_rating}-star CMS staffing — likely understaffed`);
      }

      // Demand signal in their county (cross-ref)
      const hasSignal = r.county && demandSignals.some((s) =>
        (s.county === r.county) || (s.location || "").includes(r.county) || (s.city && r.city && s.city === r.city)
      );
      if (hasSignal) {
        score += 15; breakdown.demand_signal = 15;
        intel.push("Active demand signal in county (Industry Pulse)");
      }

      // Address
      if (r.verified_address || (r.address_line1 && r.city && r.zip)) {
        score += 10; breakdown.verified_address = 10;
      }
      // Fax (only counts when channel hint includes fax)
      if ((r.channel_hint === "fax" || r.channel_hint === "both") && r.verified_fax && r.fax_number) {
        score += 10; breakdown.verified_fax = 10;
      }
      // Phone
      if (r.phone) { score += 5; breakdown.has_phone = 5; }
      // Website present (proxy for "outdated check" — bumps slightly when present)
      if (r.website) { score += 5; breakdown.has_website = 5; }

      // Federal contract / recent license signal (already-set flags from scrapers)
      if (r.recent_federal_contract) { score += 15; breakdown.federal_contract = 15; intel.push("Recent federal contract award"); }
      if (r.has_active_job_postings) { score += 20; breakdown.active_hiring = 20; intel.push("Actively posting jobs"); }

      score = Math.max(0, Math.min(100, score));
      await sb.from("prospect_pool").update({
        lead_score: score,
        score_breakdown: breakdown,
        intel_notes: intel,
        scored_at: new Date().toISOString(),
        has_demand_signal: hasSignal,
      }).eq("id", r.id);
      scoredCount++;
    }

    return new Response(JSON.stringify({ ok: true, scored: scoredCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[score-prospects]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
