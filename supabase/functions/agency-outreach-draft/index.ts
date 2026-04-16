import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateWithOpus } from "../_shared/opus.ts";
import { scrubText } from "../_shared/sanitize-candidate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Admin-only — generates Trojan Horse outreach emails using Claude Opus.
 * Returns drafted emails for copy-paste from Matt's inbox (TCPA-safe, no auto-send).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { agency_name, contact_name, vertical, recent_candidates, cherry_picked } = await req.json();
    if (!agency_name || !vertical) throw new Error("agency_name and vertical required");

    const candidatesBlock = (recent_candidates || []).slice(0, 3).map((c: any, i: number) =>
      `${i + 1}. ${c.name} — ${c.licensed_role} (${c.county}) — ${c.signal_strength} signal`
    ).join("\n");

    const cherryNote = cherry_picked
      ? "The FIRST candidate listed below is hand-selected by Matt as the strongest match. Lead with that one specifically — mention them by role + county before the others."
      : "";

    const system = `You are Matt Michels, founder of Detroit Web Agency, writing a personal outreach email to a staffing agency director. You are NOT selling software — you are offering one free, pre-vetted candidate as a "proof of concept." Never mention: AI, scraping, LARA, MIOSHA, license databases, web scraping, registries, Apollo, LinkedIn, or any data source. Use the term "proprietary talent signal engine" if methodology comes up. Write conversationally. Aim for 110-140 words. End with a single low-friction CTA: "Want me to send the full profile?"`;

    const prompt = `Write a cold outreach email TO ${contact_name || "the Director of Recruiting"} at ${agency_name}, a Metro Detroit ${vertical} staffing agency.

Hook: Our talent signal engine just flagged ${(recent_candidates || []).length} pre-market candidates that match their typical placements. Offer ONE candidate FREE as proof. If they place this person, they keep the full commission — no fee owed to us.

${cherryNote}

Available candidates (mention the strongest one by role + county only — never expose the verification ID or signal source):
${candidatesBlock}

Subject line: short, specific, no clickbait. Mention the role + county.

Output format:
SUBJECT: <subject line>
BODY: <email body with line breaks>`;

    const draft = await generateWithOpus(prompt, system, 800);
    const scrubbed = scrubText(draft);

    // Log the draft (admin audit trail)
    try {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabase.from("ai_action_queue").insert({
        action_type: "agency_outreach_draft",
        ai_result: scrubbed,
        context: { agency_name, contact_name, vertical },
        status: "pending",
      });
    } catch (_) { /* non-blocking */ }

    return new Response(JSON.stringify({ ok: true, draft: scrubbed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
