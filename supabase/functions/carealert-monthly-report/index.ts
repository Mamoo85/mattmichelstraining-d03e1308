// carealert-monthly-report — Sends monthly "proof of work" summary to CareAlert/TechAlert healthcare clients.
// Cron: 0 13 1 * * (9am ET on the 1st of every month).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { dwaEmail } from "../_shared/dwa-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function isHealthcareClient(roles: unknown): boolean {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => /cna|lpn|rn|nurse|nursing|caregiver|cma/i.test(String(r)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthLabel = monthStart.toLocaleString("en-US", { month: "long", year: "numeric" });

  try {
    const { data: clients } = await sb
      .from("hire_alert_clients")
      .select("id, owner_email, company_name, target_roles, state")
      .or("active.eq.true,trial_status.eq.active");

    let sent = 0;
    const PLACEMENT_FEE = 3500;

    for (const c of (clients || []) as any[]) {
      if (!c.owner_email || !isHealthcareClient(c.target_roles)) continue;

      // Statewide new license issuances this past month
      const { count: stateLicenses } = await sb
        .from("hire_alert_candidates")
        .select("id", { count: "exact", head: true })
        .gte("license_issue_date", monthStart.toISOString())
        .lt("license_issue_date", monthEnd.toISOString())
        .eq("state", c.state || "MI");

      const { count: delivered } = await sb
        .from("hire_REDACTED")
        .select("id", { count: "exact", head: true })
        .eq("client_id", c.id)
        .gte("created_at", monthStart.toISOString())
        .lt("created_at", monthEnd.toISOString());

      const deliveredN = delivered ?? 0;
      const savings = deliveredN * PLACEMENT_FEE;
      const name = c.company_name || "there";

      const html = `<div style="font-family:Arial,sans-serif;max-width:560px;color:#111;line-height:1.6;">
<h2 style="color:#0a1628;">Your CareAlert Summary — ${monthLabel}</h2>
<p>Hi ${name},</p>
<p>Here's what CareAlert did for you this past month:</p>
<ul>
  <li><strong>${stateLicenses ?? 0}</strong> new nursing license issuances monitored in ${c.state || "MI"}</li>
  <li><strong>${deliveredN}</strong> same-county candidate alerts delivered to your team</li>
  <li><strong>Estimated savings vs. agency placement fees: $${savings.toLocaleString()}</strong> (${deliveredN} × $${PLACEMENT_FEE.toLocaleString()})</li>
</ul>
<p>Your $149/month subscription paid for itself ${Math.max(1, Math.round(savings / 149))}× over this month alone.</p>
<p>Questions or want to expand coverage? Just reply.</p>
<p>— Matt Michels<br>Detroit Web Agency<br>(313) 992-1219</p>
</div>`;

      const r = await dwaEmail({
        to: c.owner_email,
        subject: `Your CareAlert Summary for ${monthLabel} — ${stateLicenses ?? 0} new nurses monitored`,
        html,
      });
      if (r.ok) sent++;
      await new Promise((res) => setTimeout(res, 200));
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "carealert-monthly-report",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: { sent, month: monthLabel },
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({ ok: true, sent, month: monthLabel }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[carealert-monthly-report] fatal:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
