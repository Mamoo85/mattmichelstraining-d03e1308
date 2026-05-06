// signal-triggered-sms-draft — When an account's intent score crosses 85
// AND we have a recipient_phone on file, draft a 2-line SMS pitch into the
// approval queue (channel='sms'). Matt approves once, twilio fires.
//
// Different from intent-spike-notifier (which alerts MATT). This drafts SMS
// to the PROSPECT.
//
// Idempotency: `signal-sms-${accountKey}-${YYYY-MM-DD}` — one SMS draft per
// account per day.

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
const SCORE_THRESHOLD = 85;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Latest snapshot per account where score >= 85
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: snaps, error } = await sb
      .from("intent_score_snapshots")
      .select("account_key, score, computed_at, contributing_signals, company_name, vertical, location")
      .gte("score", SCORE_THRESHOLD)
      .gte("computed_at", since)
      .order("computed_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    // Dedupe to latest per account
    const latest = new Map<string, any>();
    for (const s of snaps || []) {
      if (!latest.has(s.account_key)) latest.set(s.account_key, s);
    }

    const today = new Date().toISOString().slice(0, 10);
    let drafted = 0, skipped = 0, noPhone = 0;

    for (const [accountKey, snap] of latest) {
      // Try to resolve phone from contractor/field/hire_alert prospect tables
      let phone: string | null = null;
      const { data: prospect } = await sb
        .from("prospect_companies" as any)
        .select("phone")
        .ilike("company_name", snap.company_name || "")
        .limit(1).maybeSingle();
      phone = (prospect as any)?.phone || null;
      if (!phone) { noPhone++; continue; }

      const idem = `signal-sms-${accountKey}-${today}`;
      const { data: existing } = await sb
        .from("outreach_approval_queue")
        .select("id").eq("idempotency_key", idem).maybeSingle();
      if (existing) { skipped++; continue; }

      const sigs: any[] = Array.isArray(snap.contributing_signals) ? snap.contributing_signals : [];
      const topSig = sigs[0]?.signal_type ? `${sigs[0].signal_type} (${sigs[0].source || ""})` : "high intent activity";

      const prompt = `Write a 2-sentence SMS (max 320 chars) to ${snap.company_name || "the prospect"}. They just hit a high intent score (${Math.round(snap.score)}/100) because: ${topSig}. Sentence 1: lead with one specific thing you noticed (NOT "Hi I'm Matt"). Sentence 2: ask for 5 min by phone this afternoon. Sign off "— Matt, Detroit Web Agency · Reply STOP to opt out". Direct, no emojis, no exclamation marks.`;

      let body = "";
      try { body = await generateWithHaiku(prompt, "Cold SMS, founder voice, under 320 chars total including sign-off.", 200); }
      catch (e) { await logError("signal-triggered-sms-draft", "ai_fail", String(e), { accountKey }); continue; }
      if (!body || body.length < 30) { skipped++; continue; }
      if (body.length > 480) body = body.slice(0, 470) + "…";

      const { error: insErr } = await sb.from("outreach_approval_queue").insert({
        source_function: "signal-triggered-sms-draft",
        channel: "sms",
        account_key: accountKey,
        account_name: snap.company_name,
        account_location: snap.location,
        account_vertical: snap.vertical,
        recipient_phone: phone,
        draft_body: body,
        signal_reason: `Intent score ${Math.round(snap.score)} — ${topSig}`,
        signal_payload: { score: snap.score, contributing_signals: sigs.slice(0, 3) },
        confidence_score: Math.min(0.99, snap.score / 100),
        idempotency_key: idem,
      });
      if (insErr) { await logError("signal-triggered-sms-draft", "insert_fail", insErr.message, {}); continue; }
      drafted++;
    }

    return new Response(JSON.stringify({ ok: true, candidates: latest.size, drafted, skipped, no_phone: noPhone }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    await logError("signal-triggered-sms-draft", "fatal", String(e), {});
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
