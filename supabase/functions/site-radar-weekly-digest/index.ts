// site-radar-weekly-digest — Monday 7am cron, sends visitor summary to each SiteRadar client.
// Only sends if there was at least 1 business visitor. Subject uses top company name.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: clients } = await sb
    .from("field_crm_clients")
    .select("id, business_name, email, dispatch_token")
    .eq("status", "active")
    .not("stripe_subscription_id", "is", null);

  let sent = 0;
  for (const client of (clients || []) as Array<{ id: string; business_name: string; email: string; dispatch_token?: string }>) {
    const { data: events } = await sb
      .from("crm_visitor_events")
      .select("company_name, city, page_visited, visit_count, is_business")
      .eq("client_id", client.id)
      .gte("created_at", since)
      .order("visit_count", { ascending: false });

    if (!events?.length) continue;
    const businesses = (events as Array<{ company_name?: string; city?: string; page_visited?: string; visit_count: number; is_business: boolean }>).filter((e) => e.is_business && e.company_name);
    if (!businesses.length) continue;

    const totalVisits = events.length;
    const topCompany = businesses[0];
    const portalUrl = client.dispatch_token
      ? `https://detroitwebagent.com/my-site-radar?token=${client.dispatch_token}`
      : "https://detroitwebagent.com/my-site-radar";

    const rows = businesses.slice(0, 5).map((b) =>
      `<tr><td style="padding:8px;border-bottom:1px solid #1e293b;">${b.company_name}</td><td style="padding:8px;border-bottom:1px solid #1e293b;">${b.city || "—"}</td><td style="padding:8px;border-bottom:1px solid #1e293b;">${b.page_visited || "homepage"}</td><td style="padding:8px;border-bottom:1px solid #1e293b;">${b.visit_count}</td></tr>`
    ).join("");

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "SiteRadar <matt@detroitwebagent.com>",
        to: [client.email],
        subject: `${topCompany.company_name} visited your site this week — ${totalVisits} total visits`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0a1628;color:#fff;padding:32px;border-radius:8px;">
            <h2 style="color:#00d4ff;margin:0 0 8px;">Your weekly visitor report</h2>
            <p style="margin:0 0 20px;color:#94a3b8;">${totalVisits} visits · ${businesses.length} companies identified</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <thead><tr style="color:#00d4ff;text-align:left;">
                <th style="padding:8px;">Company</th><th style="padding:8px;">City</th><th style="padding:8px;">Page</th><th style="padding:8px;">Visits</th>
              </thead><tbody>${rows}</tbody>
            </table>
            <a href="${portalUrl}" style="display:inline-block;margin-top:24px;background:#00d4ff;color:#0a1628;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none;">View full dashboard →</a>
          </div>`,
      }),
    });
    sent++;
  }

  return new Response(JSON.stringify({ ok: true, sent }), { headers: { "Content-Type": "application/json" } });
});
