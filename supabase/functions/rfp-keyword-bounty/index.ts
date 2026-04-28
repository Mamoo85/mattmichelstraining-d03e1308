// rfp-keyword-bounty — Scans industry_pulse_signals for high-value RFP keywords
// (e.g., "managed services", "field service software", "ATS migration", "phone
// system upgrade") and immediately drafts a tailored pitch tying our product
// to the exact RFP language. Runs every 4h.
//
// Idempotency: `rfp-bounty-${signal_id}` — one draft per signal.

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

// Bounty map: keyword regex → { product, value, hook }
const BOUNTIES: Array<{ pattern: RegExp; product: string; value: number; hook: string }> = [
  { pattern: /\bfield service (software|management|crm|platform)\b/i, product: "FieldDesk", value: 0.95, hook: "FieldDesk replaces ServiceTitan/Jobber for half the price with same-day onboarding." },
  { pattern: /\b(ats|applicant tracking|recruit\w+ software)\b/i, product: "TechAlert", value: 0.9, hook: "TechAlert front-runs your ATS — we surface licensed candidates the moment they renew, before they hit Indeed." },
  { pattern: /\b(answering service|virtual receptionist|phone (system|answering))\b/i, product: "AI Phone Answering", value: 0.85, hook: "Our AI receptionist captures every missed call, books, and texts back in under 30 seconds." },
  { pattern: /\b(reputation management|review (gen|management))\b/i, product: "AI Reputation Dashboard", value: 0.8, hook: "Auto-requests reviews from happy customers and intercepts unhappy ones before they go public." },
  { pattern: /\b(lead gen|lead generation|pay per lead|exclusive leads)\b/i, product: "Contractor Leads PPL", value: 0.95, hook: "We sell exclusive Detroit-metro homeowner leads ($399/mo, no contracts). 3x cheaper than Angi/HomeAdvisor." },
  { pattern: /\b(missed call|callback|call recovery)\b/i, product: "Missed-Call Catch", value: 0.85, hook: "Every missed call gets an instant SMS + voicemail transcription + 5-minute callback reminder. $99/mo, plug-and-play." },
  { pattern: /\b(mortgage lead|loan officer|trigger lead|refi lead)\b/i, product: "Mortgage Radar", value: 0.9, hook: "Mortgage Radar flags property events (permits, court records, FSBO) BEFORE the credit bureaus — TCPA-safe." },
  { pattern: /\b(website (build|redesign|overhaul)|web design)\b/i, product: "DWA Web Design", value: 0.7, hook: "We build conversion-first sites in 7 days — flat $2,500, no monthly bs." },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const { data: signals, error } = await sb
      .from("industry_pulse_signals")
      .select("id, account_key, account_name, vertical, location, signal_type, content, source_url, detected_at, meta")
      .gte("detected_at", since)
      .limit(2000);
    if (error) throw error;

    let drafted = 0, skipped = 0, scanned = signals?.length || 0;
    const matches: Array<{ sig: any; bounty: any }> = [];

    for (const sig of signals || []) {
      const text = `${sig.content || ""} ${sig.signal_type || ""}`;
      for (const b of BOUNTIES) {
        if (b.pattern.test(text)) { matches.push({ sig, bounty: b }); break; }
      }
    }

    for (const { sig, bounty } of matches.slice(0, 30)) {
      const idem = `rfp-bounty-${sig.id}`;
      const { data: existing } = await sb
        .from("outreach_approval_queue")
        .select("id").eq("idempotency_key", idem).maybeSingle();
      if (existing) { skipped++; continue; }

      const snippet = (sig.content || "").slice(0, 300).replace(/\s+/g, " ").trim();
      const prompt = `Cold email to ${sig.account_name || "the team"} at ${sig.location || "their company"}. They published this signal: "${snippet}". This matches our ${bounty.product} product. Hook angle: "${bounty.hook}" Open with one specific phrase from their post showing you read it. Sentence 2: tie our product to the EXACT language they used. Sentence 3: one quantified proof point. Sentence 4: ask for 10 minutes this week. 4 sentences max, founder voice, no marketing fluff.`;

      let body = "";
      try { body = await generateWithHaiku(prompt, "B2B outbound that references the prospect's exact language. Specific > clever.", 600); }
      catch (e) { await logError("rfp-keyword-bounty", "ai_fail", String(e), { sig_id: sig.id }); continue; }
      if (!body || body.length < 50) { skipped++; continue; }

      const { error: insErr } = await sb.from("outreach_approval_queue").insert({
        source_function: "rfp-keyword-bounty",
        channel: "email",
        account_key: sig.account_key,
        account_name: sig.account_name,
        account_location: sig.location,
        account_vertical: sig.vertical,
        draft_subject: `Re: ${snippet.slice(0, 50)}…`,
        draft_body: body,
        signal_reason: `RFP keyword match: ${bounty.product} (${bounty.pattern.source})`,
        signal_payload: { product: bounty.product, source_url: sig.source_url, snippet, signal_id: sig.id },
        confidence_score: bounty.value,
        idempotency_key: idem,
      });
      if (insErr) { await logError("rfp-keyword-bounty", "insert_fail", insErr.message, {}); continue; }
      drafted++;
    }

    return new Response(JSON.stringify({ ok: true, scanned, matches: matches.length, drafted, skipped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    await logError("rfp-keyword-bounty", "fatal", String(e), {});
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
