// cohort-campaign-builder — Admin-triggered. Accepts cohort filters
// (vertical, signal_types, min_score, location_state, limit) and a
// campaign_brief. For each matching account, drafts a personalized email
// into outreach_approval_queue. Bulk-personalized cold campaigns in 1 click.
//
// Body: { vertical?, signal_types?: string[], min_score?: number,
//          state?: string, limit?: number, channel?: 'email'|'sms',
//          campaign_brief: string, campaign_name: string }
//
// Idempotency: `cohort-${campaign_name}-${accountKey}` — one draft per account per campaign.

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

interface CohortBody {
  campaign_name: string;
  campaign_brief: string;
  vertical?: string;
  signal_types?: string[];
  min_score?: number;
  state?: string;
  limit?: number;
  channel?: "email" | "sms";
  subject_template?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body: CohortBody = await req.json();
    if (!body.campaign_name || !body.campaign_brief) {
      return new Response(JSON.stringify({ error: "campaign_name and campaign_brief required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const channel = body.channel || "email";
    const limit = Math.min(body.limit || 50, 200);
    const minScore = body.min_score ?? 50;

    // Pull latest snapshot per account
    let q = sb.from("intent_score_snapshots")
      .select("account_key, company_name, vertical, location, score, contributing_signals, computed_at")
      .gte("score", minScore)
      .order("computed_at", { ascending: false })
      .limit(800);
    if (body.vertical) q = q.eq("vertical", body.vertical);
    const { data: snaps, error } = await q;
    if (error) throw error;

    const latest = new Map<string, any>();
    for (const s of snaps || []) {
      if (!latest.has(s.account_key)) latest.set(s.account_key, s);
    }

    let candidates = Array.from(latest.values());
    if (body.state) candidates = candidates.filter((c) => (c.location || "").toUpperCase().includes(body.state!.toUpperCase()));
    if (body.signal_types?.length) {
      candidates = candidates.filter((c) => {
        const sigs = Array.isArray(c.contributing_signals) ? c.contributing_signals : [];
        const sigStr = sigs.map((s: any) => `${s.signal_type || ""} ${s.source || ""}`).join(" ").toLowerCase();
        return body.signal_types!.some((t) => sigStr.includes(t.toLowerCase()));
      });
    }
    candidates = candidates.slice(0, limit);

    let drafted = 0, skipped = 0, noContact = 0;
    const errors: string[] = [];

    // Process in parallel batches of 5 for AI throughput
    const batchSize = 5;
    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      await Promise.all(batch.map(async (snap) => {
        const idem = `cohort-${body.campaign_name}-${snap.account_key}`;
        const { data: existing } = await sb
          .from("outreach_approval_queue")
          .select("id").eq("idempotency_key", idem).maybeSingle();
        if (existing) { skipped++; return; }

        // Resolve contact info from prospect tables (best-effort; queue still creates draft if missing)
        let recipientEmail: string | null = null;
        let recipientPhone: string | null = null;
        const { data: prospect } = await sb
          .from("prospect_companies" as any)
          .select("email, phone")
          .ilike("company_name", snap.company_name || "")
          .limit(1).maybeSingle();
        recipientEmail = (prospect as any)?.email || null;
        recipientPhone = (prospect as any)?.phone || null;

        if (channel === "sms" && !recipientPhone) { noContact++; return; }
        if (channel === "email" && !recipientEmail) { noContact++; /* still draft so admin can fill */ }

        const sigs: any[] = Array.isArray(snap.contributing_signals) ? snap.contributing_signals : [];
        const topSig = sigs.slice(0, 2).map((s: any) => `${s.signal_type || ""} (${s.source || ""})`).join("; ") || "no specific signal";

        const prompt = channel === "sms"
          ? `Cold SMS (max 320 chars) to ${snap.company_name}. Campaign brief: "${body.campaign_brief}". Their recent signals: ${topSig}. 2 sentences, founder voice, end with "— Matt, DWA · Reply STOP".`
          : `Cold email to ${snap.company_name} (${snap.location || ""}, ${snap.vertical || ""}). Campaign brief: "${body.campaign_brief}". Their recent intent signals: ${topSig}. 4 sentences max. Open with one specific signal observation. Tie campaign to their situation. End with a single ask. Founder voice, no fluff.`;

        let draftBody = "";
        try { draftBody = await generateWithHaiku(prompt, "Personalized cold outreach. Reference the prospect's exact signals.", channel === "sms" ? 200 : 600); }
        catch (e) { errors.push(`${snap.account_key}: ${String(e).slice(0, 80)}`); return; }
        if (!draftBody || draftBody.length < 30) { skipped++; return; }

        const subject = channel === "email"
          ? (body.subject_template || `${snap.company_name} — quick question`).replace(/\{\{name\}\}/g, snap.company_name || "")
          : null;

        const { error: insErr } = await sb.from("outreach_approval_queue").insert({
          source_function: "cohort-campaign-builder",
          channel,
          account_key: snap.account_key,
          account_name: snap.company_name,
          account_location: snap.location,
          account_vertical: snap.vertical,
          recipient_email: channel === "email" ? recipientEmail : null,
          recipient_phone: channel === "sms" ? recipientPhone : null,
          draft_subject: subject,
          draft_body: draftBody,
          signal_reason: `Cohort '${body.campaign_name}' — score ${Math.round(snap.score)}, signals: ${topSig}`,
          signal_payload: { campaign: body.campaign_name, brief: body.campaign_brief, score: snap.score },
          confidence_score: Math.min(0.95, snap.score / 100),
          idempotency_key: idem,
        });
        if (insErr) { errors.push(`${snap.account_key}: ${insErr.message.slice(0, 80)}`); return; }
        drafted++;
      }));
    }

    return new Response(JSON.stringify({
      ok: true,
      campaign: body.campaign_name,
      cohort_size: candidates.length,
      drafted, skipped, no_contact: noContact,
      errors: errors.slice(0, 10),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    await logError("cohort-campaign-builder", "fatal", String(e), {});
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
