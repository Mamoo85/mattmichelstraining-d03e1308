// dossier-cold-outreach (Channel 1)
// Admin-triggered: queue a personalized cold email + free dossier offer to a named buyer
// at a supply house, routed through email_reply_drafts ghost delay (Matt-cancellable).
//
// Flow: admin posts { signal_id, target_company, target_email, target_contact_name?, vertical? }
//   → AI generates 4-sentence personal email referencing the signal
//   → row inserted into email_reply_drafts with 10-min ghost delay
//   → row inserted into dossier_outreach_log for dedup + tracking
//   → SMS preview to Matt with cancel link
//
// Dedup: refuses to queue if same target_email got a dossier email in last 30 days.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") ?? "+13138064952";

const GHOST_DELAY_MINUTES = 10;
const DEDUP_DAYS = 30;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendAdminSMS(body: string) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return;
  try {
    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: ADMIN_PHONE, From: TWILIO_PHONE_NUMBER, Body: body }),
    });
  } catch (e) {
    console.error("[dossier-cold-outreach] sms fail", e);
  }
}

async function generateEmailBody(signal: any, targetCompany: string, contactName: string | null, vertical: string | null): Promise<{ subject: string; body: string }> {
  const greeting = contactName ? `Hey ${contactName.split(" ")[0]},` : `Hey,`;
  const fallback = {
    subject: `${signal.company_name} just posted ${signal.hiring_count || "multiple"} ${(signal.hiring_roles?.[0] || "trade")} openings — thought ${targetCompany} should know`,
    body: `${greeting}

Quick heads-up — ${signal.company_name} (${signal.location || "Metro Detroit"}) just posted ${signal.hiring_count || "several"} openings for ${(signal.hiring_roles || []).join(", ") || "skilled trades"}. New crews = new ${(signal.predicted_needs?.[0] || "supply")} orders within 30 days.

I built a small intelligence tool that flags Metro Detroit manufacturers right when they start hiring — found 42 like this one in the last 7 days. I'm sending the full one-page dossier on ${signal.company_name} (name, address, hiring detail, predicted spend window) attached as a free sample.

If it's useful, $50 gets you the next 5 from your vertical. Reply YES and I'll send them over.

Worst case, you delete this. Best case, your ${vertical || "branch"} team gets a 30-day jump on a new account.`,
  };

  if (!LOVABLE_API_KEY) return fallback;

  const prompt = `You are Matt Michels, owner of Detroit Web Agency in Grosse Pointe, MI. Write a cold email to a branch manager at a Metro Detroit industrial supply house.

CONTEXT:
- Recipient company: ${targetCompany}${contactName ? ` (contact: ${contactName})` : ""}
- Their vertical: ${vertical || "industrial supply"}
- Signal you're pitching: ${signal.company_name} (${signal.location || "Metro Detroit"}) just posted ${signal.hiring_count || "several"} openings for ${(signal.hiring_roles || []).join(", ") || "skilled trades"}
- Predicted needs from the new hires: ${(signal.predicted_needs || []).join(", ") || "consumables and equipment"}
- Confidence score: ${signal.confidence}/10

STRICT RULES:
1. Exactly 4 sentences in the body. No more, no less.
2. First sentence: name-drop ${signal.company_name} and the hiring detail.
3. Second sentence: explain in plain English why this means the recipient's branch is about to get an order opportunity.
4. Third sentence: offer a FREE one-page dossier on this exact company as proof.
5. Fourth sentence: $50 gets the next 5 dossiers in their vertical — reply YES.
6. NO mention of "AI", "algorithms", "machine learning", "intelligence platforms". Sound human, local, like a guy who built something useful.
7. NO emojis. NO em-dashes. Casual but professional.
8. Greeting: "${greeting}"
9. Sign-off: just leave it blank — the email template adds Matt's signature.

Return ONLY a JSON object: { "subject": "...", "body": "..." }
The subject line MUST mention ${signal.company_name} by name and create curiosity for ${targetCompany}.
Body must start with the greeting on its own line, then a blank line, then the 4 sentences.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    if (parsed?.subject && parsed?.body) {
      return { subject: String(parsed.subject).slice(0, 200), body: String(parsed.body) };
    }
    return fallback;
  } catch (e) {
    console.error("[dossier-cold-outreach] AI fail, using fallback", e);
    return fallback;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { signal_id, target_company, target_email, target_contact_name, vertical } = await req.json();

    if (!signal_id || !target_company || !target_email) {
      return new Response(JSON.stringify({ error: "signal_id, target_company, target_email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target_email)) {
      return new Response(JSON.stringify({ error: "invalid email" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── 1. Dedup: same target email already got a dossier email in last 30 days?
    const cutoff = new Date(Date.now() - DEDUP_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await sb
      .from("dossier_outreach_log")
      .select("id, status, sent_at")
      .eq("target_email", target_email.toLowerCase().trim())
      .gte("created_at", cutoff)
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({
        skipped: true,
        reason: `${target_email} already received a dossier outreach within ${DEDUP_DAYS} days`,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── 2. Fetch signal
    const { data: signal, error: sigErr } = await sb
      .from("industry_pulse_signals")
      .select("id, company_name, location, industry, hiring_roles, hiring_count, predicted_needs, confidence, recommended_pitch")
      .eq("id", signal_id)
      .maybeSingle();

    if (sigErr || !signal) {
      return new Response(JSON.stringify({ error: "signal not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 3. Generate email body
    const { subject, body } = await generateEmailBody(signal, target_company, target_contact_name || null, vertical || null);

    // ── 4. Queue in email_reply_drafts (10-min ghost delay)
    const sendAfter = new Date(Date.now() + GHOST_DELAY_MINUTES * 60 * 1000).toISOString();
    const { data: draft, error: draftErr } = await sb
      .from("email_reply_drafts")
      .insert({
        lead_email: target_email.toLowerCase().trim(),
        draft_subject: subject,
        draft_body: body,
        category: "dossier_cold_outreach",
        send_after: sendAfter,
      })
      .select("id")
      .single();

    if (draftErr) {
      console.error("[dossier-cold-outreach] draft insert fail", draftErr);
      return new Response(JSON.stringify({ error: draftErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 5. Log to dossier_outreach_log
    await sb.from("dossier_outreach_log").insert({
      signal_id: signal.id,
      signal_company: signal.company_name,
      target_company,
      target_email: target_email.toLowerCase().trim(),
      target_contact_name: target_contact_name || null,
      status: "queued",
      draft_id: draft?.id || null,
      subject,
      body_preview: body.slice(0, 240),
    });

    // ── 6. SMS Matt the preview + cancel link
    const cancelUrl = `${SUPABASE_URL}/functions/v1/cancel-reply-draft?id=${draft?.id}`;
    const preview = body.slice(0, 90).replace(/\n/g, " ");
    await sendAdminSMS(
      `Dossier email queued: ${target_company} (${target_email}). Re: ${signal.company_name}. Sends in ${GHOST_DELAY_MINUTES}min. Cancel: ${cancelUrl}`
    );

    return new Response(JSON.stringify({
      ok: true,
      draft_id: draft?.id,
      send_after: sendAfter,
      subject,
      preview,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[dossier-cold-outreach]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
