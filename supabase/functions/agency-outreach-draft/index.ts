import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateWithOpus } from "../_shared/opus.ts";
import { scrubText } from "../_shared/sanitize-candidate.ts";
import {
  buildTrojanHorseHtml,
  buildTrojanHorsePlainText,
  type TeaserCandidate,
} from "../_shared/email-templates/trojan-horse-outreach.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Admin-only — drafts a Trojan Horse outreach email using Claude Opus and
 * renders it through the branded HTML template. Returns BOTH a structured
 * HTML body (ready to send via Gmail) and a plain-text fallback.
 *
 * Backwards compatible: still returns `draft` (legacy SUBJECT/BODY string)
 * for older UI flows.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      agency_name,
      contact_name,           // legacy: title
      vertical,
      recent_candidates = [],
      cherry_picked = false,
      contact_first_name,     // NEW: enriched
      contact_last_name,
      contact_title,          // NEW: enriched title overrides legacy
    } = body;

    if (!agency_name || !vertical) throw new Error("agency_name and vertical required");

    const candidatesBlock = (recent_candidates || []).slice(0, 3).map((c: any, i: number) =>
      `${i + 1}. ${c.licensed_role} (${c.county}) — ${c.signal_strength} signal`
    ).join("\n");

    const titleForGreeting = contact_title || contact_name || "Director of Recruiting";
    const greetingTarget = contact_first_name
      ? `${contact_first_name} (${titleForGreeting})`
      : titleForGreeting;

    const cherryNote = cherry_picked
      ? "The FIRST candidate listed below is hand-selected by Matt as the strongest match. Reference that one specifically in the intro paragraph."
      : "";

    const system = `You are Matt Michels, founder of Detroit Web Agency, writing a personal outreach email to a staffing agency leader. You are NOT selling software — you are offering one free, pre-vetted candidate as a "proof of concept." Never mention: AI, scraping, LARA, MIOSHA, license databases, web scraping, registries, Apollo, LinkedIn, or any data source. Use the term "proprietary talent signal engine" if methodology comes up. Write conversationally — like a real person typed it, not marketing copy.`;

    const prompt = `Write outreach copy TO ${greetingTarget} at ${agency_name}, a Metro Detroit ${vertical} staffing agency.

Hook: Our talent signal engine just flagged ${(recent_candidates || []).length} pre-market candidates that match their typical placements. Offer ONE candidate FREE as proof. If they place this person, they keep the full commission — no fee owed to us.

${cherryNote}

Available candidates (mention the strongest one by role + county only — never expose the verification ID or signal source):
${candidatesBlock}

OUTPUT EXACTLY THIS FORMAT (no markdown, no extra commentary):
SUBJECT: <short subject line — mention role + county, no clickbait>
INTRO: <2-3 sentence opening paragraph that introduces the offer and mentions the cherry-picked candidate's role + county>
BRIDGE: <optional 1-2 sentence bridge paragraph about why this candidate fits ${agency_name}'s typical placements — leave blank if not needed>
CTA: <single-line call to action button label, max 6 words, e.g. "Send me the full profile">`;

    const draft = await generateWithOpus(prompt, system, 900);
    const scrubbed = scrubText(draft);

    // Parse the structured output
    const subjectMatch = scrubbed.match(/SUBJECT:\s*([^\n]+)/i);
    const introMatch = scrubbed.match(/INTRO:\s*([\s\S]*?)(?=\n\s*(?:BRIDGE|CTA):|$)/i);
    const bridgeMatch = scrubbed.match(/BRIDGE:\s*([\s\S]*?)(?=\n\s*CTA:|$)/i);
    const ctaMatch = scrubbed.match(/CTA:\s*([^\n]+)/i);

    // Strip any trailing section label the model may have packed onto the subject line
    const subject = (subjectMatch?.[1] || `Pre-market candidate — ${agency_name}`)
      .replace(/\s*(INTRO|BRIDGE|CTA):.*$/i, "")
      .trim();
    const intro = (introMatch?.[1] || "").trim();
    const bridge = (bridgeMatch?.[1] || "").trim();
    const ctaLabel = (ctaMatch?.[1] || "Send me the full profile").trim().replace(/^["']|["']$/g, "");

    // Pick primary + alts from the candidate list
    const primary: TeaserCandidate = recent_candidates[0]
      ? {
          licensed_role: recent_candidates[0].licensed_role,
          county: recent_candidates[0].county,
          signal_strength: recent_candidates[0].signal_strength,
        }
      : { licensed_role: "Pre-vetted candidate", county: "Metro Detroit", signal_strength: "exceptional" };

    const alts: TeaserCandidate[] = (recent_candidates.slice(1, 3) || []).map((c: any) => ({
      licensed_role: c.licensed_role,
      county: c.county,
      signal_strength: c.signal_strength,
    }));

    const html_body = buildTrojanHorseHtml({
      greeting_name: contact_first_name || null,
      agency_name,
      intro_paragraph: intro || `Matt Michels here from Detroit Web Agency. Our proprietary talent signal engine surfaced a pre-market candidate that fits ${agency_name}'s typical placements — happy to send the full profile your way at no cost as a proof point.`,
      bridge_paragraph: bridge || undefined,
      primary_candidate: primary,
      alt_candidates: alts,
      cta_label: ctaLabel,
      reply_to: "matt@detroitwebagent.com",
    });

    const plain_body = buildTrojanHorsePlainText({
      greeting_name: contact_first_name || null,
      agency_name,
      intro_paragraph: intro,
      bridge_paragraph: bridge || undefined,
      primary_candidate: primary,
      alt_candidates: alts,
      cta_label: ctaLabel,
    });

    // Legacy-format draft string for backwards compatibility
    const legacy_draft = `SUBJECT: ${subject}\n\n${plain_body}`;

    // Audit log
    try {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabase.from("ai_action_queue").insert({
        action_type: "agency_outreach_draft",
        ai_result: legacy_draft,
        context: { agency_name, contact_first_name, contact_title, vertical, cherry_picked },
        status: "pending",
      });
    } catch (_) { /* non-blocking */ }

    return new Response(JSON.stringify({
      ok: true,
      subject,
      html_body,
      plain_body,
      cta_label: ctaLabel,
      draft: legacy_draft, // legacy compat
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
