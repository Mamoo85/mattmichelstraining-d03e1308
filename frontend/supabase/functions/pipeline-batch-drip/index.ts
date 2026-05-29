import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { isBlocked, recordOutreach } from "../_shared/outreach-blocklist.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const EMAIL_SIGNATURE = `
<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;">
  <div style="font-size:13px;color:#94a3b8;">
    <strong style="color:#e2e8f0;">Matt Michels</strong> | Lead Web Agent<br/>
    Detroit Web Agency · (313) 992-1219
  </div>
</div>`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { leadIds, action } = await req.json();
    // action: "draft_all" | "send_all" | "send_drafted"

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return new Response(JSON.stringify({ error: "leadIds array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY && action !== "draft_all") {
      return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch all leads
    const { data: leads, error: fetchErr } = await sb
      .from("prospect_pipeline")
      .select("*")
      .in("id", leadIds);

    if (fetchErr) throw new Error(fetchErr.message);
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ error: "No leads found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For draft_all, we can draft even without email. For send actions, require email.
    const emailableLeads = action === "draft_all"
      ? leads
      : leads.filter((l: any) => !!l.email);
    if (emailableLeads.length === 0) {
      return new Response(JSON.stringify({ error: "None of the selected leads have an email address" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { id: string; business: string; status: string; error?: string }[] = [];
    let sentCount = 0;
    let draftedCount = 0;
    let errorCount = 0;

    // Minimum days between drip steps (step 1→2: 3 days, 2→3: 4 days, 3→4: 7 days)
    const MIN_DAYS_BETWEEN_STEPS: Record<number, number> = { 2: 3, 3: 4, 4: 7 };

    for (const lead of emailableLeads) {
      try {
        const currentStep = (lead.drip_step || 0) + 1;
        if (currentStep > 4) {
          results.push({ id: lead.id, business: lead.business_name, status: "skipped_complete" });
          continue;
        }

        // 90-day blocklist check (skip paying clients + recent contacts)
        if (action !== "draft_all" && lead.email) {
          const blk = await isBlocked(sb, { email: lead.email, business_name: lead.business_name });
          if (blk.blocked) {
            results.push({ id: lead.id, business: lead.business_name, status: `skipped_blocked_${blk.reason}` });
            continue;
          }
        }

        // Enforce minimum delay between drip steps
        if (currentStep > 1 && lead.last_drip_at) {
          const daysSinceLastDrip = (Date.now() - new Date(lead.last_drip_at).getTime()) / 86400000;
          const minDays = MIN_DAYS_BETWEEN_STEPS[currentStep] || 3;
          if (daysSinceLastDrip < minDays) {
            results.push({ id: lead.id, business: lead.business_name, status: `skipped_too_soon_${Math.round(minDays - daysSinceLastDrip)}d_left` });
            continue;
          }
        }

        let subject = lead.drip_subject;
        let body = lead.drip_body;

        // If sending drafted emails, use existing draft
        if (action === "send_drafted") {
          if (!subject || !body) {
            results.push({ id: lead.id, business: lead.business_name, status: "skipped_no_draft" });
            continue;
          }
        } else {
          // Generate with AI
          if (!LOVABLE_API_KEY) throw new Error("Missing LOVABLE_API_KEY");

          const DRIP_PROMPTS: Record<number, string> = {
            1: `Write a SHORT cold email (3-4 sentences max). The first line MUST reference a specific gap or issue from the gap analysis. Offer a pre-built demo. No buzzwords. Sound like a local contractor, not a marketer.`,
            2: `Write a SHORT follow-up (2-3 sentences). Reference the previous email about their specific gap. Ask if they had 2 minutes to look at the demo. Add one new observation. No buzzwords.`,
            3: `Write a SHORT value-add email (3 sentences). Share one actionable tip specific to their industry. Mention you noticed something new on their site. Keep it casual, like texting a neighbor.`,
            4: `Write a SHORT final-touch email (2-3 sentences). Be direct: "I'm going to stop bugging you, but I wanted to leave this here." Reference the original gap one last time. Make it feel human and final.`,
          };

          const gapAnalysis = lead.gap_analysis || lead.deep_research?.summary || "";
          const prompt = `You are writing on behalf of Matt Michels, Lead Web Agent at Detroit Web Agency (Grosse Pointe, MI).

CONTEXT:
Business: ${lead.business_name}
Industry: ${lead.industry || "local business"}
City: ${lead.city || "Metro Detroit"}
Website: ${lead.website || "none found"}
Gap Analysis: "${gapAnalysis}"
Drip Step: ${currentStep} of 4

RULES:
${DRIP_PROMPTS[currentStep] || DRIP_PROMPTS[1]}
- NEVER say "Hope this finds you well" or "Dear Business Owner"
- NEVER use: AI, Synergy, Algorithm, Digital Transformation, Leverage, Game-Changer
- Talk like a local Detroit guy, not a marketing agency
- Sign off: Matt Michels | Lead Web Agent | Detroit Web Agency

Return JSON: {"subject": "...", "body": "..."}
Return ONLY valid JSON, no markdown.`;

          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{ role: "user", content: prompt }],
              temperature: 0.7,
            }),
          });

          if (!aiRes.ok) throw new Error(`AI error: ${aiRes.status}`);
          const ai = await aiRes.json();
          const raw = ai.choices?.[0]?.message?.content?.trim() || "";

          try {
            const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            const parsed = JSON.parse(cleaned);
            subject = parsed.subject || `Quick note about ${lead.business_name}`;
            body = parsed.body || raw;
          } catch {
            subject = `Quick note about ${lead.business_name}`;
            body = raw;
          }
        }

        if (action === "draft_all") {
          await sb.from("prospect_pipeline").update({
            drip_subject: subject,
            drip_body: body,
            drip_status: "drafted",
            updated_at: new Date().toISOString(),
          }).eq("id", lead.id);
          draftedCount++;
          results.push({ id: lead.id, business: lead.business_name, status: "drafted" });
          continue;
        }

        // Send the email
        const htmlBody = body
          .split("\n")
          .map((line: string) => line.trim() === "" ? "<br>" : `<p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:14px;color:#333;">${line}</p>`)
          .join("\n") + EMAIL_SIGNATURE;

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Matt Michels | Detroit Web Agency <matt@detroitwebagent.com>",
            reply_to: "matt@detroitwebagent.com",
            to: [lead.email],
            bcc: ["matthewmichels4@gmail.com"],
            subject,
            html: htmlBody,
          }),
        });

        if (!emailRes.ok) {
          const errText = await emailRes.text();
          if (emailRes.status === 429) {
            // Quota hit — stop sending remaining
            results.push({ id: lead.id, business: lead.business_name, status: "quota_exceeded" });
            errorCount++;
            // Break out — no point trying more
            for (const remaining of emailableLeads.slice(emailableLeads.indexOf(lead) + 1)) {
              results.push({ id: remaining.id, business: remaining.business_name, status: "skipped_quota" });
            }
            break;
          }
          throw new Error(`Email send failed: ${emailRes.status} ${errText}`);
        }

        // Log to prospect_email_log
        const resendData = await emailRes.json();
        await sb.from("prospect_email_log").insert({
          pipeline_lead_id: lead.id,
          business_name: lead.business_name,
          recipient_email: lead.email,
          subject,
          drip_step: currentStep,
          status: "sent",
          resend_id: resendData?.id || null,
        });

        // Update pipeline lead
        await sb.from("prospect_pipeline").update({
          drip_step: currentStep,
          drip_status: currentStep >= 4 ? "completed" : "active",
          drip_subject: subject,
          drip_body: body,
          last_drip_at: new Date().toISOString(),
          pipeline_stage: "outreach_sent",
          updated_at: new Date().toISOString(),
        }).eq("id", lead.id);

        sentCount++;
        results.push({ id: lead.id, business: lead.business_name, status: "sent" });

        // Record 90-day cooldown
        await recordOutreach(sb, { email: lead.email, business_name: lead.business_name, agent: "pipeline-batch-drip" });

        // Small delay between sends to avoid rate limits
        await new Promise(r => setTimeout(r, 500));

      } catch (err) {
        errorCount++;
        results.push({
          id: lead.id,
          business: lead.business_name,
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total: emailableLeads.length,
      sent: sentCount,
      drafted: draftedCount,
      errors: errorCount,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[pipeline-batch-drip]", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
