import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateWithOpus } from "../_shared/opus.ts";
import { scrubText } from "../_shared/sanitize-candidate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Daily 10am ET cron — finds Proof Drop recipients (free-candidate emails sent
 * 36–60h ago) with no booked interview, drafts an Opus follow-up, and queues
 * it in ai_action_queue for Matt's manual send.
 *
 * TCPA-safe: never auto-sends. Matt copies + pastes from his inbox.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    // Find recently-drafted Proof Drop emails (logged by agency-outreach-draft)
    const since = new Date(Date.now() - 60 * 3600 * 1000).toISOString();
    const until = new Date(Date.now() - 36 * 3600 * 1000).toISOString();

    const { data: drops = [] } = await supabase
      .from("ai_action_queue")
      .select("id, context, ai_result, created_at")
      .eq("action_type", "agency_outreach_draft")
      .gte("created_at", since)
      .lte("created_at", until)
      .limit(20);

    let drafted = 0;
    const drafts: any[] = [];

    for (const drop of drops || []) {
      const ctx = (drop.context || {}) as any;
      const agencyName = ctx.agency_name;
      if (!agencyName) continue;

      // Skip if we already drafted a follow-up for this drop
      const { count: existing = 0 } = await supabase
        .from("ai_action_queue")
        .select("id", { count: "exact", head: true })
        .eq("action_type", "agency_proof_drop_followup")
        .gte("created_at", since)
        .filter("context->>agency_name", "eq", agencyName);
      if ((existing ?? 0) > 0) continue;

      // Skip if the agency already booked an interview (signed up + clicked Fast-Track)
      const { data: agency } = await supabase
        .from("staffing_agency_clients")
        .select("id")
        .ilike("agency_name", agencyName)
        .maybeSingle();
      if (agency?.id) {
        const { count: booked = 0 } = await supabase
          .from("agency_candidate_assignments")
          .select("id", { count: "exact", head: true })
          .eq("agency_id", agency.id)
          .not("interview_booked_at", "is", null);
        if ((booked ?? 0) > 0) continue;
      }

      const system = `You are Matt Michels, founder of Detroit Web Agency, writing a SHORT 48-hour follow-up to a staffing agency director. Tone: friendly, low-pressure, confident. Never mention: AI, scraping, LARA, MIOSHA, license databases, registries, Apollo, LinkedIn, or any data source. 60–90 words. Single CTA: offer two more candidates.`;
      const prompt = `Two days ago you sent a free pre-vetted candidate to ${ctx.contact_name || "the Director of Recruiting"} at ${agencyName} (Metro Detroit ${ctx.vertical} staffing). They haven't responded. Write a short follow-up:
- Acknowledge the gap ("might've gotten buried")
- Reaffirm the offer (no fee owed if they place the candidate)
- Offer 2 more candidates as a soft second touch
- End with: "Want me to send them over?"

Output:
SUBJECT: <line>
BODY: <body with line breaks>`;

      try {
        const draft = await generateWithOpus(prompt, system, 600);
        const scrubbed = scrubText(draft);
        await supabase.from("ai_action_queue").insert({
          action_type: "agency_proof_drop_followup",
          ai_result: scrubbed,
          context: { agency_name: agencyName, contact_name: ctx.contact_name, vertical: ctx.vertical, original_drop_id: drop.id },
          status: "pending",
        });
        drafts.push({ agency: agencyName, preview: scrubbed.slice(0, 180) });
        drafted++;
      } catch (e) {
        console.error(`[proof-drop-followup] Draft failed for ${agencyName}:`, e);
      }
    }

    // Notify Matt with a digest if anything new
    if (drafted > 0) {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
      if (RESEND_API_KEY) {
        const rows = drafts.map(d => `<li style="margin:8px 0;color:#e2e8f0;"><strong>${d.agency}</strong><br><span style="color:#94a3b8;font-size:12px;">${d.preview}…</span></li>`).join("");
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Detroit Web Agency <matt@detroitwebagent.com>",
            to: "matt@detroitwebagent.com",
            subject: `📨 ${drafted} Proof Drop follow-ups ready to send`,
            html: `<!DOCTYPE html><html><body style="margin:0;background:#0a1628;font-family:-apple-system,sans-serif;padding:32px;">
              <h1 style="color:#00d4ff;font-size:22px;">Proof Drop Follow-Ups</h1>
              <p style="color:#94a3b8;">${drafted} agencies haven't responded after 48h. Drafts queued in /dwa-admin → Agency Outreach.</p>
              <ul style="padding-left:20px;">${rows}</ul>
            </body></html>`,
          }),
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, candidates_checked: (drops || []).length, drafts_created: drafted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
