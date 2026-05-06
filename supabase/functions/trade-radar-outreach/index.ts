// trade-radar-outreach — Daily cron at 11am ET.
// For each active Trade Radar client, emails today's enriched leads on their behalf.
// Cap: 10 emails/day/vertical to avoid spam flags.
// Only sends to leads with owner_email set and outreach_sent_at null.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateWithHaiku } from "../_shared/opus.ts";
import { isRecentlyContacted } from "../_shared/outreach-blocklist.ts";
import { dwaEmail } from "../_shared/dwa-email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const DAILY_CAP_PER_VERTICAL = 40;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VERTICAL_LABELS: Record<string, string> = {
  roofing: "roofing",
  hvac: "HVAC",
  plumbing: "plumbing",
  electrical: "electrical",
  pest_control: "pest control",
  gutters: "gutter cleaning",
  exterior: "exterior renovation",
  tree: "tree service",
  restoration: "restoration",
  demo_junk: "demolition & junk removal",
  foundation: "foundation repair",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  let totalSent = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  try {
    const { data: clients } = await sb
      .from("trade_radar_clients")
      .select("id, email, owner_name, company_name, vertical, city, phone")
      .eq("active", true);

    if (!clients?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, note: "no active clients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const since24h = new Date(Date.now() - 7 * 86400000).toISOString(); // 7-day window — don't abandon enriched leads

    for (const client of clients) {
      const verticalLabel = VERTICAL_LABELS[client.vertical] || client.vertical;

      const { data: leads } = await sb
        .from("trade_radar_leads")
        .select("id, address, city, signal_type, score, estimated_job_value, owner_name, owner_email")
        .eq("vertical", client.vertical)
        .not("owner_email", "is", null)
        .is("outreach_sent_at", null)
        .gte("created_at", since24h)
        .order("score", { ascending: false })
        .limit(DAILY_CAP_PER_VERTICAL);

      if (!leads?.length) continue;

      for (const lead of leads) {
        if (!lead.owner_email) continue;

        // Cross-product dedup: skip if contacted this domain in last 7 days
        const emailDomain = lead.owner_email.split("@")[1];
        if (emailDomain && await isRecentlyContacted(sb, emailDomain)) {
          totalSkipped++;
          continue;
        }

        try {
          const signalDisplay = (lead.signal_type || "recent activity").replace(/_/g, " ");
          const jobValue = lead.estimated_job_value
            ? `$${Number(lead.estimated_job_value).toLocaleString()}`
            : null;

          const prompt = `Write a 3-sentence cold email from a local ${verticalLabel} contractor to a homeowner.
Signal at their property: ${signalDisplay}${jobValue ? ` (estimated $${jobValue} job)` : ""}
Contractor: ${client.company_name || client.owner_name || "a local contractor"} based in ${client.city || "Detroit, MI"}

Rules:
- First sentence: reference the specific situation at their address without being creepy
- Second sentence: briefly state what you offer and why now is the right time
- Third sentence: soft CTA (reply or quick call — nothing pushy)
- No greeting or sign-off. Under 75 words total.`;

          const emailBody = await generateWithHaiku(prompt, "You write concise, friendly contractor outreach emails.", 200);

          const firstName = lead.owner_name?.split(" ")[0] || "there";
          const locationHint = lead.address || lead.city || client.city || "your area";
          const subject = `Quick note about ${locationHint}`;

          const html = `<div style="font-family:sans-serif;max-width:600px;color:#1a1a1a;line-height:1.7;font-size:15px">
<p>Hi ${firstName},</p>
<p>${emailBody.trim().replace(/\n\n/g, "</p><p>").replace(/\n/g, " ")}</p>
<p style="margin-top:20px">Best,<br>
<strong>${client.owner_name || client.company_name || "Matt"}</strong><br>
${client.company_name ? `<span style="color:#555">${client.company_name}</span>` : ""}
</p>
<p style="font-size:11px;color:#aaa;border-top:1px solid #f0f0f0;padding-top:12px;margin-top:20px">
You received this because your property matched a local service opportunity in your area.<br>
Reply STOP to unsubscribe from future messages.
</p>
</div>`;

          const res = await dwaEmail({
            to: lead.owner_email,
            subject,
            html,
            replyTo: client.email || "matt@detroitwebagent.com",
          });

          if (res.ok) {
            await sb.from("trade_radar_leads")
              .update({
                outreach_sent_at: new Date().toISOString(),
                outreach_email: lead.owner_email,
              })
              .eq("id", lead.id);

            // Log to global dedup table
            if (emailDomain) {
              await sb.from("global_outreach_log").insert({
                domain: emailDomain,
                email: lead.owner_email,
                product: `trade_radar_${client.vertical}`,
                campaign: "cold_outreach",
              }).then(() => {}, () => {});
            }

            totalSent++;
          } else {
            const errText = await res.text().catch(() => "");
            console.error(`[trade-radar-outreach] Resend error for lead ${lead.id}: ${errText}`);
            totalFailed++;
          }
        } catch (e) {
          totalFailed++;
          console.error(`[trade-radar-outreach] lead ${lead.id}:`, e instanceof Error ? e.message : e);
        }

        await new Promise((r) => setTimeout(r, 150));
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent: totalSent, failed: totalFailed, skipped: totalSkipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
