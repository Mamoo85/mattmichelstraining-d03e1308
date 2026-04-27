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
const BROWSERLESS = Deno.env.get("BROWSERLESS_API_KEY") || "";

const GHOST_DELAY_MINUTES = 10;
const DEDUP_DAYS = 30;
const PDF_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

// Generate the dossier HTML (re-uses generate-signal-dossier), render to PDF via
// Browserless, upload to private storage, return a 30-day signed URL.
// Returns null on any failure — caller falls back to email without attachment.
async function buildDossierPdfUrl(sb: any, signal_id: string): Promise<string | null> {
  try {
    const { data, error } = await sb.functions.invoke("generate-signal-dossier", {
      body: { signal_id },
    });
    if (error) throw new Error(`dossier gen: ${error.message}`);
    const html: string | undefined = (data as any)?.html;
    if (!html) throw new Error("dossier gen: empty html");
    if (!BROWSERLESS) {
      console.warn("[dossier-cold-outreach] BROWSERLESS_API_KEY missing — sending without PDF");
      return null;
    }
    const pdfRes = await fetch(`https://chrome.browserless.io/pdf?token=${BROWSERLESS}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html,
        options: { format: "Letter", printBackground: true, margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" } },
        gotoOptions: { waitUntil: "networkidle2", timeout: 30000 },
      }),
    });
    if (!pdfRes.ok) {
      const txt = await pdfRes.text();
      throw new Error(`browserless ${pdfRes.status}: ${txt.slice(0, 200)}`);
    }
    const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());
    const path = `signals/${signal_id}/${Date.now()}.pdf`;
    const { error: upErr } = await sb.storage.from("dossier-pdfs")
      .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(`upload: ${upErr.message}`);
    const { data: signed } = await sb.storage.from("dossier-pdfs").createSignedUrl(path, PDF_TTL_SECONDS);
    return signed?.signedUrl || null;
  } catch (e) {
    console.error("[dossier-cold-outreach] PDF build failed:", e);
    return null;
  }
}

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

Quick heads-up — ${signal.company_name} (${signal.location || "Metro Detroit"}) just pulled ${signal.hiring_count || "several"} permits/postings for ${(signal.hiring_roles || []).join(", ") || "skilled trades"}, which usually means new ${(signal.predicted_needs?.[0] || "supply")} orders inside the next 30 days.

Their PO desk hasn't placed those orders yet — your branch could be the first call if a rep reaches out this week before competitors notice.

I attached the full one-page dossier on ${signal.company_name} below — name, address, hiring detail, predicted 30-day spend window, all from public records, no charge.

If it's useful, $50 unlocks the next 5 dossiers like this in your ${vertical || "vertical"} — just reply YES and I'll send them over.`,
  };

  if (!LOVABLE_API_KEY) return fallback;

  const prompt = `You are Matt Michels, owner of Detroit Web Agency in Grosse Pointe, MI. Write a cold email to a branch manager at a Metro Detroit industrial supply house.

CONTEXT:
- Recipient company: ${targetCompany}${contactName ? ` (contact: ${contactName})` : ""}
- Their vertical: ${vertical || "industrial supply"}
- Signal you're pitching: ${signal.company_name} (${signal.location || "Metro Detroit"}) just posted ${signal.hiring_count || "several"} openings/permits for ${(signal.hiring_roles || []).join(", ") || "skilled trades"}
- Predicted needs from the new hires: ${(signal.predicted_needs || []).join(", ") || "consumables and equipment"}
- Confidence score: ${signal.confidence}/10

STRICT RULES:
1. Exactly 4 sentences in the body. No more, no less.
2. Sentence 1: name-drop ${signal.company_name}, the hiring/permit detail, and the 30-day spend window for ${signal.predicted_needs?.[0] || "their category"}.
3. Sentence 2: tease that ${targetCompany}'s branch could be first call before competitors notice.
4. Sentence 3: tell them the FREE one-page dossier on ${signal.company_name} is attached below (name, address, hiring detail, predicted 30-day spend window, public records). Use the literal phrase "attached below" so the link slot reads naturally.
5. Sentence 4: $50 unlocks the next 5 dossiers in their vertical this month — reply YES.
6. NO mention of "AI", "algorithms", "machine learning", "intelligence platforms". Sound human, local, like a guy who built something useful.
7. NO emojis. NO em-dashes. Casual but professional.
8. Greeting: "${greeting}"
9. Sign-off: leave it blank — the email template adds Matt's signature and the dossier download link.

Return ONLY a JSON object: { "subject": "...", "body": "..." }
The subject MUST mention ${signal.company_name} by name and signal a 30-day spending window.
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
    const { signal_id, target_company, target_email, target_contact_name, vertical, silent } = await req.json();

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
    const { subject, body: rawBody } = await generateEmailBody(signal, target_company, target_contact_name || null, vertical || null);

    // ── 3b. Build dossier PDF + signed URL (best-effort; falls back gracefully)
    const pdfUrl = await buildDossierPdfUrl(sb, signal.id);
    const attachmentBlock = pdfUrl
      ? `\n\n📎 Free dossier on ${signal.company_name} (PDF, no login required):\n${pdfUrl}\n\n(Link valid 30 days. One page. Public records only.)`
      : `\n\n(Reply "DOSSIER" and I'll send the one-pager on ${signal.company_name} by return email.)`;

    const signature = `\n\n— Matt Michels\nDetroit Web Agency\n(313) 992-1219\nmatt@detroitwebagent.com\ndetroitwebagent.com`;

    const body = `${rawBody}${attachmentBlock}${signature}`;

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
    if (!silent) {
      await sendAdminSMS(
        `Dossier email queued: ${target_company} (${target_email}). Re: ${signal.company_name}. Sends in ${GHOST_DELAY_MINUTES}min. Cancel: ${cancelUrl}`
      );
    }

    return new Response(JSON.stringify({
      ok: true,
      draft_id: draft?.id,
      send_after: sendAfter,
      subject,
      preview,
      cancel_url: cancelUrl,
      pdf_url: pdfUrl,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[dossier-cold-outreach]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
