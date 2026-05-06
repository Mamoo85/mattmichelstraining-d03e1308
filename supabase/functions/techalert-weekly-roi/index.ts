import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Generate and send weekly ROI report emails to TechAlert subscribers.
 * Shows: candidates delivered, claimed, hired, cost per hire vs staffing agency.
 *
 * Triggered by cron every Monday at 8am ET.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");

    // Get all active TechAlert clients
    const { data: clients } = await supabase
      .from("hire_alert_clients")
      .select("id, email, company_name, plan_price")
      .eq("active", true);

    if (!clients?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: "No active clients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let totalSent = 0;

    for (const client of clients) {
      // Count candidates delivered this week
      const { count: delivered } = await supabase
        .from("hire_alert_candidates")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since);

      // Count claimed by this client
      const { count: claimed } = await supabase
        .from("hire_alert_candidates")
        .select("id", { count: "exact", head: true })
        .eq("claimed_by", client.id)
        .gte("claimed_at", since);

      // Count hired by this client
      const { count: hired } = await supabase
        .from("hire_alert_candidates")
        .select("id", { count: "exact", head: true })
        .eq("claimed_by", client.id)
        .eq("client_action", "hired")
        .gte("created_at", since);

      const planPrice = client.plan_price || 149;
      const costPerHire = hired && hired > 0 ? Math.round(planPrice / hired) : null;
      const staffingAgencyCost = hired && hired > 0 ? hired * 4500 : 0; // avg 30% of $15k salary
      const savings = staffingAgencyCost - planPrice;

      const html = `
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,sans-serif;background:#0d1117;color:#e6edf3;padding:32px;">
  <div style="max-width:500px;margin:0 auto;background:#161b22;border:1px solid #30363d;border-radius:12px;padding:32px;">
    <h1 style="font-size:18px;margin:0 0 8px;">Weekly TechAlert Report</h1>
    <p style="color:#8b949e;font-size:13px;margin:0 0 24px;">${client.company_name} — Week of ${new Date().toLocaleDateString()}</p>

    <div style="display:flex;gap:12px;margin-bottom:24px;">
      <div style="flex:1;background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:16px;text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#4493f8;">${delivered || 0}</div>
        <div style="font-size:11px;color:#8b949e;">Candidates Delivered</div>
      </div>
      <div style="flex:1;background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:16px;text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#d29922;">${claimed || 0}</div>
        <div style="font-size:11px;color:#8b949e;">Claimed by You</div>
      </div>
      <div style="flex:1;background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:16px;text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#3fb950;">${hired || 0}</div>
        <div style="font-size:11px;color:#8b949e;">Hired</div>
      </div>
    </div>

    ${costPerHire ? `
    <div style="background:#12351e;border:1px solid #3fb95030;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="color:#3fb950;font-weight:700;font-size:14px;margin:0 0 8px;">Your ROI This Week</p>
      <p style="color:#8b949e;font-size:12px;margin:0;">
        Cost per hire: <strong style="color:#3fb950;">$${costPerHire}</strong><br>
        Staffing agency would've charged: <strong style="color:#f85149;">$${staffingAgencyCost.toLocaleString()}</strong><br>
        You saved: <strong style="color:#3fb950;">$${savings.toLocaleString()}</strong>
      </p>
    </div>
    ` : `
    <div style="background:#21262d;border:1px solid #30363d;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="color:#8b949e;font-size:12px;margin:0;">
        No hires this week. Claim candidates early for 48h exclusivity — the best ones go fast.
      </p>
    </div>
    `}

    <a href="https://detroitwebagent.com/field-service/dispatch?token=${client.id}" style="display:block;background:#4493f8;color:#fff;text-align:center;padding:12px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">
      View Your Pipeline
    </a>

    <p style="color:#484f58;font-size:10px;text-align:center;margin-top:16px;">
      Detroit Web Agency — We Handle The Tech<br>
      Matt Michels · (313) 992-1219
    </p>
  </div>
</body>
</html>`;

      if (RESEND_KEY && client.email) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "TechAlert <alerts@detroitwebagent.com>",
              to: client.email,
              subject: `Weekly Report: ${delivered || 0} candidates, ${hired || 0} hired — ${client.company_name}`,
              html,
            }),
          });
          totalSent++;
        } catch { /* continue */ }
      }
    }

    return new Response(JSON.stringify({ sent: totalSent, clients: clients.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
