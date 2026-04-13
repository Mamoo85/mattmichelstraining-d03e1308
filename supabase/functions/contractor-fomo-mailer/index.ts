// contractor-fomo-mailer — daily cron 3pm ET
// Finds contractors who missed 3+ leads in the last 7 days (tried to buy, lead was sold/locked)
// Sends a "you're losing ground" email nudging them to lock their territory at $399/mo.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const SITE_URL = "https://detroitwebagent.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Find contractors with 3+ missed leads in the last 7 days
    // who are NOT on a territory lock subscription (active = false or no subscription)
    const { data: missedViews } = await sb
      .from("contractor_lead_views" as any)
      .select("contractor_id, trade, city")
      .gte("created_at", sevenDaysAgo);

    if (!missedViews?.length) {
      return new Response(JSON.stringify({ ok: true, emailed: 0 }), { status: 200 });
    }

    // Aggregate misses per contractor
    const missesByContractor = new Map<string, { count: number; trades: Set<string>; cities: Set<string> }>();
    for (const view of missedViews) {
      if (!missesByContractor.has(view.contractor_id)) {
        missesByContractor.set(view.contractor_id, { count: 0, trades: new Set(), cities: new Set() });
      }
      const entry = missesByContractor.get(view.contractor_id)!;
      entry.count++;
      if (view.trade) entry.trades.add(view.trade);
      if (view.city) entry.cities.add(view.city);
    }

    // Only contractors with 3+ misses
    const eligible = [...missesByContractor.entries()].filter(([, v]) => v.count >= 3);
    if (!eligible.length) {
      return new Response(JSON.stringify({ ok: true, emailed: 0 }), { status: 200 });
    }

    // Fetch contractor details for eligible IDs
    const eligibleIds = eligible.map(([id]) => id);
    const { data: contractors } = await sb
      .from("contractor_clients")
      .select("id, email, name, business_name, stripe_subscription_id")
      .in("id", eligibleIds)
      .eq("active", false); // Only non-subscribers — don't spam paying customers

    if (!contractors?.length) {
      return new Response(JSON.stringify({ ok: true, emailed: 0 }), { status: 200 });
    }

    let emailed = 0;

    for (const contractor of contractors) {
      if (!contractor.email) continue;

      const missData = missesByContractor.get(contractor.id);
      if (!missData) continue;

      const missCount = missData.count;
      const tradeList = [...missData.trades].join(", ") || "service";
      const cityList = [...missData.cities].slice(0, 2).join(" and ") || "your area";
      const upgradeUrl = `${SITE_URL}/contractor-leads?upgrade=1&prefilled_email=${encodeURIComponent(contractor.email)}`;
      const firstName = contractor.name?.split(" ")[0] || contractor.business_name || "Hey";

      const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f8fafc;padding:32px;margin:0;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;">
  <div style="background:#00d4ff;height:4px;"></div>
  <div style="padding:28px 32px;color:#1e293b;font-size:15px;line-height:1.9;">
    <p style="margin:0 0 16px;"><strong>${firstName} —</strong></p>
    <p style="margin:0 0 16px;">You tried to grab <strong>${missCount} ${tradeList} leads</strong> in ${cityList} this week. Every one of them was already taken.</p>
    <p style="margin:0 0 16px;">Here's what's happening: other contractors in your area are locking their territory. When they lock it, every lead that comes in for their trade goes directly to them — before you even see it.</p>
    <p style="margin:0 0 24px;">You can do the same thing for <strong>$399/mo flat</strong>. No per-lead fees. Every future lead in your trade and city is yours automatically.</p>
    <a href="${upgradeUrl}" style="display:block;background:#00d4ff;color:#0a1628;border-radius:8px;padding:14px 24px;font-size:16px;font-weight:800;text-align:center;text-decoration:none;margin-bottom:20px;">
      Lock My Territory — $399/mo
    </a>
    <p style="color:#64748b;font-size:13px;margin:0;">7-day free trial. Cancel anytime. The next lead in your area is either yours or it goes to someone who locked it.</p>
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:13px;color:#334155;">
      <strong>Matt Michels</strong> · Detroit Web Agency · <a href="tel:+13139921219" style="color:#00d4ff;">(313) 992-1219</a>
    </div>
  </div>
</div></body></html>`;

      if (RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Matt Michels <matt@detroitwebagent.com>",
            to: [contractor.email],
            bcc: ["matt@detroitwebagent.com"],
            subject: `You missed ${missCount} ${tradeList} leads this week`,
            html,
          }),
        });
        emailed++;
      }
    }

    console.log(`[fomo-mailer] Emailed ${emailed} contractors`);
    return new Response(
      JSON.stringify({ ok: true, emailed, eligible: eligible.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[fomo-mailer] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
