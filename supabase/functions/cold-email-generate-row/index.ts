// cold-email-generate-row — produce a single tailored cold email
// (subject + body + opener) for a (signal, buyer, contact) triple, given
// the bandit-selected arms. Uses Lovable AI Gateway (Gemini 2.5 Flash).
//
// Input: { signal_id, buyer_id, contact_id, arms: { subject, opener, cta }, tone? }
// Output: { subject, body, opener, cta_text, model, tokens_used }

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, type SubjectArm, type OpenerArm, type CtaArm } from "../_shared/coldEmailShared.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const SUBJECT_INSTR: Record<SubjectArm, string> = {
  urgency: "Subject must convey time-sensitivity in <60 chars (e.g., 'this week', '30-day window').",
  name_drop_signal: "Subject must mention the SIGNAL company name and a concrete number from the signal.",
  question: "Subject must be a short question that hints at the buyer's blind spot.",
  permit_specific: "Subject must reference a permit / hiring detail like 'permit #' or '5 new hires'.",
  competitor_threat: "Subject must imply a competitor is about to win the order — no fearmongering.",
};

const OPENER_INSTR: Record<OpenerArm, string> = {
  direct: "Opener: one declarative sentence with the signal fact. No fluff.",
  curious: "Opener: one short curiosity-gap sentence ending in a soft question.",
  value: "Opener: lead with the buyer's potential dollar value of the signal.",
};

const CTA_INSTR: Record<CtaArm, string> = {
  free_dossier: "CTA: offer the free 1-page dossier — no charge, link below.",
  "25": "CTA: offer the unlocked dossier + contact pack for $25.",
  "50": "CTA: offer the unlocked dossier + contact pack + intro email script for $50.",
  "99": "CTA: offer the unlocked dossier + contact pack + warm intro for $99.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { signal_id, buyer_id, contact_id, arms, tone = "professional" } = await req.json();
    if (!signal_id || !arms) {
      return new Response(JSON.stringify({ error: "signal_id and arms required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const [{ data: signal }, { data: buyer }, { data: contact }] = await Promise.all([
      sb.from("growth_signals").select("*").eq("id", signal_id).maybeSingle(),
      buyer_id ? sb.from("industrial_supply_buyers").select("*").eq("id", buyer_id).maybeSingle() : Promise.resolve({ data: null }),
      contact_id ? sb.from("buyer_contacts").select("*").eq("id", contact_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    if (!signal) {
      return new Response(JSON.stringify({ error: "signal_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const firstName = (contact?.full_name || "").split(" ")[0] || null;
    const buyerCompany = buyer?.company_name || "your branch";
    const sigCompany = signal.company_name || "the company";
    const sigCity = signal.location || signal.city || "Metro Detroit";
    const needs = (signal.predicted_needs || []).slice(0, 3).join(", ") || "supply orders";
    const hires = signal.hiring_count || signal.permit_count || "multiple";
    const roles = (signal.hiring_roles || []).slice(0, 2).join(", ") || "trades";

    const prompt = `You write 60-second cold sales emails for industrial supply branch managers.
TONE: ${tone}. Plain text. No emojis. No "Dear". 4 short sentences max in body. Sign off with "Matt Michels — Detroit Web Agency, +1 (313) 992-1219".

SIGNAL CONTEXT:
- Company hiring: ${sigCompany} (${sigCity})
- Activity: ${hires} new ${roles} positions / permits
- Predicted 30-day buy: ${needs}

RECIPIENT:
- Branch / company: ${buyerCompany}
- Contact: ${contact?.full_name || "(no name — use 'Hi,')"} (${contact?.title || "manager"})

ARM INSTRUCTIONS:
- ${SUBJECT_INSTR[arms.subject as SubjectArm]}
- ${OPENER_INSTR[arms.opener as OpenerArm]}
- ${CTA_INSTR[arms.cta as CtaArm]}

OUTPUT JSON ONLY:
{"subject":"...","opener":"...","body":"<full body including opener, value bullet, cta, signoff>","cta_text":"..."}`;

    let subject = "", body = "", opener = "", cta_text = "", model = "gemini-2.5-flash", tokens_used = 0;

    if (LOVABLE_API_KEY) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You output STRICT JSON only. No markdown fences." },
            { role: "user", content: prompt },
          ],
          temperature: 0.55,
        }),
      });
      if (aiRes.ok) {
        const j = await aiRes.json();
        tokens_used = j?.usage?.total_tokens || 0;
        let txt: string = j?.choices?.[0]?.message?.content || "";
        txt = txt.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
        try {
          const parsed = JSON.parse(txt);
          subject = String(parsed.subject || "");
          body = String(parsed.body || "");
          opener = String(parsed.opener || "");
          cta_text = String(parsed.cta_text || "");
        } catch (err) {
          console.error("[cold-email-generate-row] AI JSON parse failed", err, txt.slice(0, 200));
        }
      } else {
        console.error("[cold-email-generate-row] AI call failed", aiRes.status, await aiRes.text());
      }
    }

    // Deterministic fallback so the engine never returns empty
    if (!subject || !body) {
      const greeting = firstName ? `Hi ${firstName},` : "Hi,";
      subject = `${sigCompany} just added ${hires} ${roles} — ${buyerCompany} should know`;
      opener = `${sigCompany} in ${sigCity} just pulled ${hires} new ${roles} permits/postings — typically a 30-day spend window for ${needs}.`;
      body = `${greeting}

${opener}

Their PO desk hasn't placed those orders yet. ${buyerCompany} could be the first call this week before competitors notice.

I built a 1-page dossier (name, address, hiring detail, predicted spend window) — pulled from public records, no charge.

— Matt Michels
Detroit Web Agency · +1 (313) 992-1219`;
      cta_text = "Reply 'YES' for the dossier";
      model = "fallback";
    }

    return new Response(JSON.stringify({ subject, opener, body, cta_text, model, tokens_used, arms }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[cold-email-generate-row]", e);
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
