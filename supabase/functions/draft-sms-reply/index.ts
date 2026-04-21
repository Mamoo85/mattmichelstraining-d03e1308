// draft-sms-reply — generates an AI-suggested SMS reply for the admin SMS inbox.
// Pulls the last 10 messages of context for the given phone, blends in DWA product
// context (contractor leads pricing, FAQ, Matt's tone), and returns a 1–2 sentence
// draft via Lovable AI Gateway. Never sends — purely generative.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

// Canonical sign-up URLs — keep in sync with App.tsx routes
const SIGNUP_URLS = {
  contractor_leads: "https://detroitwebagent.com/contractor-leads",
  techalert: "https://detroitwebagent.com/hire-alert",
  fielddesk: "https://detroitwebagent.com/field-service",
  missed_call: "https://detroitwebagent.com/missed-call-catch",
};

const SYSTEM_PROMPT = `You are drafting an SMS reply on behalf of Matt Michels, owner of Detroit Web Agency (DWA).
Tone: warm, direct, blue-collar friendly. No corporate-speak. No "I hope this finds you well."
Length: 1–2 short sentences MAX. Under 320 characters. SMS, not email.

DWA product context (use only if the contractor asks):
- Contractor Leads (PPL): $399/mo flat. Exclusive territory (one contractor per trade per city). No per-lead fees, no contracts. Cancel anytime. Sign up: ${SIGNUP_URLS.contractor_leads}
- TechAlert: $149/mo. Hiring monitor — alerts when licensed tradespeople become available. Sign up: ${SIGNUP_URLS.techalert}
- FieldDesk: $199/mo. Field service CRM (dispatch, mobile tech app, GPS). Sign up: ${SIGNUP_URLS.fielddesk}
- Missed Call Catch: $99/mo. Auto-texts callers you missed. Sign up: ${SIGNUP_URLS.missed_call}
- Demo / call: (313) 992-1219.

Rules:
- Never invent prices, terms, or promises.
- If they ask "how does it work" → explain in plain English: pick trade + city, get instant SMS when a homeowner requests a quote.
- If they want to sign up, want a link, ask "where do I sign up", "send me the link", "how do I get started", etc. → INCLUDE THE FULL SIGN-UP URL in the reply. Never say "I'll send the link" without pasting it. Default to the Contractor Leads URL unless they clearly asked about a different product.
- If unclear what they want → ask one short clarifying question.
- Never say "AI" or "as an AI." Write as Matt.
- No emojis unless the contractor uses them first.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const { phone, hint } = await req.json().catch(() => ({}));
    if (!phone || typeof phone !== "string") {
      return new Response(JSON.stringify({ error: "phone required" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Pull last 10 SMS messages with this phone (both directions)
    const { data: rows } = await sb
      .from("system_comms_log")
      .select("body_preview, status, recipient, metadata, created_at, product")
      .eq("channel", "sms")
      .order("created_at", { ascending: false })
      .limit(40);

    const digits = phone.replace(/\D/g, "");
    const matches = (rows || []).filter((r: any) => {
      const meta = (r.metadata || {}) as Record<string, unknown>;
      const from = typeof meta.from === "string" ? meta.from : "";
      const recipient = (r.recipient || "") as string;
      return from.includes(digits) || recipient.includes(digits);
    }).slice(0, 10).reverse();

    const transcript = matches.map((r: any) => {
      const meta = (r.metadata || {}) as Record<string, unknown>;
      const dir =
        r.status === "inbound" || meta.direction === "inbound" || r.product === "inbound"
          ? "Contractor"
          : "Matt";
      return `${dir}: ${r.body_preview || ""}`;
    }).join("\n");

    // Lookup contact label if we have one
    let contactLabel = "";
    try {
      const { data: cc } = await sb
        .from("contractor_clients")
        .select("business_name, trade")
        .ilike("phone", `%${digits.slice(-10)}%`)
        .limit(1)
        .maybeSingle();
      if (cc) contactLabel = `Known contact: ${(cc as any).business_name} (${(cc as any).trade || "contractor"}).`;
    } catch (_) { /* noop */ }

    const userPrompt = `${contactLabel}

Recent SMS thread:
${transcript || "(no prior messages — this is the first reply)"}

${hint ? `Matt's note for this draft: ${hint}` : ""}

Draft Matt's next reply. 1–2 short sentences. SMS only.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("[draft-sms-reply] AI error:", aiRes.status, errText);
      return new Response(JSON.stringify({ error: "AI gateway error", status: aiRes.status }), {
        status: 502,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const draft = (aiData?.choices?.[0]?.message?.content || "").trim();

    return new Response(JSON.stringify({ draft, transcript_lines: matches.length }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[draft-sms-reply] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
