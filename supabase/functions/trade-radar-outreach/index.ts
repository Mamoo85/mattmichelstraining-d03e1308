// trade-radar-outreach — Daily cron at 11am ET.
// For each active Trade Radar client, emails today's enriched leads on their behalf.
// Cap: 40 emails/day/vertical. Only sends to leads with owner_email set and outreach_sent_at null.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { isRecentlyContacted } from "../_shared/outreach-blocklist.ts";
import { dwaEmail, listUnsubHeaders } from "../_shared/dwa-email.ts";

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

function buildTradeEmail(
  lead: { signal_type?: string; address?: string; city?: string; owner_name?: string; estimated_job_value?: number | string },
  client: { owner_name?: string; company_name?: string; city?: string; phone?: string; email?: string },
  verticalLabel: string,
): { subject: string; body: string } {
  const firstName = lead.owner_name?.split(" ")[0] || "there";
  const city = lead.city || client.city || "your area";
  const co = client.company_name || client.owner_name || "a local contractor";
  const phone = client.phone || "(313) 992-1219";
  const sig = `— ${client.owner_name || "Matt"}\n${co}\n${phone}`;
  const jobVal = lead.estimated_job_value
    ? ` — estimated $${Number(lead.estimated_job_value).toLocaleString()} job`
    : "";

  const signal = lead.signal_type || "";

  // Storm / hail / wind damage signals
  if (/storm|hail|wind|damage/.test(signal)) {
    return {
      subject: `${city} storm damage — ${verticalLabel} estimate needed`,
      body: `Hi ${firstName},\n\nWe monitor storm activity across ${city} and flagged your property for recent weather damage${jobVal}. Waiting too long on storm damage can turn a repair into a full replacement.\n\n${co} serves homeowners in ${city} — if you'd like a free estimate this week, just reply or call ${phone}.\n\n${sig}`,
    };
  }

  // Permit signals — roof
  if (/roof_permit|cofc_roof/.test(signal)) {
    return {
      subject: `Roof activity flagged at your address — ${city}`,
      body: `Hi ${firstName},\n\nOur system picked up roofing permit activity near your property${jobVal}. We work with homeowners in ${city} who are planning or recently completed roof work.\n\nIf you need a second quote, an inspection, or a repair alongside the main job, ${co} can typically get out within 2–3 days. Reply or call ${phone}.\n\n${sig}`,
    };
  }

  // HVAC / system age signals
  if (/hvac|aging_system|extreme_weather/.test(signal)) {
    return {
      subject: `HVAC heads-up for your ${city} home`,
      body: `Hi ${firstName},\n\nWe flagged your address based on a heating/cooling signal in your area${jobVal}. Older systems tend to fail at the worst times — usually mid-winter or peak summer.\n\n${co} handles HVAC service, tune-ups, and replacements in ${city} with same-week scheduling. Reply or call ${phone} if you'd like a free assessment.\n\n${sig}`,
    };
  }

  // Plumbing / water signals
  if (/plumbing|water_damage|lead_line|sewer/.test(signal)) {
    return {
      subject: `Plumbing signal at your ${city} address`,
      body: `Hi ${firstName},\n\nWe monitor local permit and utility data and flagged a plumbing-related signal at your address${jobVal}.\n\n${co} does fast-turnaround plumbing in ${city} — leak repair, water heater replacement, drain work, and full pipe jobs. Reply or call ${phone} for a free quote.\n\n${sig}`,
    };
  }

  // Electrical / panel signals
  if (/electrical|panel_upgrade|aging_panel/.test(signal)) {
    return {
      subject: `Electrical panel flag — ${city} homeowner`,
      body: `Hi ${firstName},\n\nOur monitoring picked up an electrical signal at your property${jobVal}. Outdated panels and overloaded circuits are a leading cause of house fires in older Michigan homes.\n\n${co} does panel upgrades, circuit additions, and full rewires in ${city}. Reply or call ${phone} for a no-obligation look.\n\n${sig}`,
    };
  }

  // Pest / vacancy signals
  if (/pest|rodent|foreclosure_vacant|overgrown/.test(signal)) {
    return {
      subject: `${city} property — pest control check`,
      body: `Hi ${firstName},\n\nWe flagged your address for a pest control signal in ${city}${jobVal}. Vacant or transitioning properties are common entry points for rodents and insects, especially going into warmer months.\n\n${co} offers free inspections and same-week treatment in ${city}. Reply or call ${phone}.\n\n${sig}`,
    };
  }

  // Fire / smoke / restoration signals
  if (/fire|smoke|mold|restoration|water_damage_permit/.test(signal)) {
    return {
      subject: `Restoration crew available — ${city}`,
      body: `Hi ${firstName},\n\nWe spotted a restoration-related signal at your address${jobVal}. Whether it's fire, smoke, mold, or water damage, the faster remediation starts, the lower the total cost.\n\n${co} handles emergency restoration and full rebuilds in ${city}. Available this week — reply or call ${phone}.\n\n${sig}`,
    };
  }

  // Demo / junk / demolition signals
  if (/demo|junk|debris|blight|demolition/.test(signal)) {
    return {
      subject: `Demo or cleanout needed — ${city} property`,
      body: `Hi ${firstName},\n\nWe monitor demolition and junk removal permits in ${city} and flagged your address${jobVal}.\n\n${co} handles full demolition, interior teardowns, estate cleanouts, and debris hauling — usually same week. Reply or call ${phone} for a fast quote.\n\n${sig}`,
    };
  }

  // Foundation / flood / drainage signals
  if (/foundation|flood|sinkhole|drainage|basement|nfip/.test(signal)) {
    return {
      subject: `Foundation or drainage issue flagged — ${city}`,
      body: `Hi ${firstName},\n\nOur system flagged a foundation or drainage signal at your property in ${city}${jobVal}. Left unaddressed, water intrusion and settlement issues get significantly more expensive.\n\n${co} does free foundation assessments in ${city} — reply or call ${phone} to schedule.\n\n${sig}`,
    };
  }

  // Tree / storm debris signals
  if (/tree|wind|storm_wind|drought_tree/.test(signal)) {
    return {
      subject: `Tree work flagged at your ${city} address`,
      body: `Hi ${firstName},\n\nWe flagged your property for a tree service signal in ${city}${jobVal}. Storm damage, dead limbs, and overgrown trees are best addressed before the next round of weather hits.\n\n${co} handles removal, trimming, and stump grinding in ${city}. Reply or call ${phone} for a free quote.\n\n${sig}`,
    };
  }

  // Gutter signals
  if (/gutter|cofc_gutter/.test(signal)) {
    return {
      subject: `Gutter check for your ${city} home`,
      body: `Hi ${firstName},\n\nWe flagged your property based on gutter-related activity in ${city}${jobVal}. Clogged or damaged gutters are the #1 cause of foundation and siding damage in Michigan homes going into fall.\n\n${co} does full gutter cleaning, repair, and guard installation in ${city}. Reply or call ${phone}.\n\n${sig}`,
    };
  }

  // Exterior / siding signals
  if (/exterior|siding|window|painting|cofc_exterior/.test(signal)) {
    return {
      subject: `Exterior work coming up — ${city} homeowner`,
      body: `Hi ${firstName},\n\nWe picked up an exterior renovation signal at your property in ${city}${jobVal}. Whether it's siding, windows, painting, or trim, the right timing saves thousands on energy and future repairs.\n\n${co} handles exterior renovations in ${city} — reply or call ${phone} for a free estimate.\n\n${sig}`,
    };
  }

  // Generic fallback per vertical
  return {
    subject: `${verticalLabel} work near your ${city} address`,
    body: `Hi ${firstName},\n\nWe monitor local permit and property data in ${city} and flagged your address for ${verticalLabel} activity${jobVal}.\n\n${co} serves homeowners in ${city} and can usually schedule within the week. Reply or call ${phone} if you'd like a free quote.\n\n${sig}`,
  };
}

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
          const { subject, body } = buildTradeEmail(lead, client, verticalLabel);

          const html = `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:560px;color:#111;line-height:1.6;font-size:15px;">
${body.replace(/\n\n/g, "</p><p style='margin:14px 0'>").replace(/\n/g, "<br>").replace(/^/, "<p style='margin:0 0 14px'>").replace(/$/, "</p>")}
<p style="margin:20px 0 4px;font-size:11px;color:#aaa;border-top:1px solid #f0f0f0;padding-top:14px;">
Reply STOP to unsubscribe.
</p>
</div>`;

          const res = await dwaEmail({
            to: lead.owner_email,
            headers: listUnsubHeaders(lead.owner_email),
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
