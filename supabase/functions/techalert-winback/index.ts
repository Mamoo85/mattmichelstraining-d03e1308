import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Win-back automation for churned TechAlert clients.
 * 30 days after cancellation, sends a "here's what you missed" SMS/email
 * with top candidates found since they left + a discount offer.
 *
 * Called by weekly cron.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");

    // Find clients who churned ~30 days ago
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);

    const { data: churned } = await supabase
      .from("hire_alert_clients")
      .select("id, company_name, email, phone, target_roles, cancelled_at")
      .eq("active", false)
      .gte("cancelled_at", thirtyFiveDaysAgo.toISOString())
      .lte("cancelled_at", thirtyDaysAgo.toISOString())
      .is("winback_sent", null);

    if (!churned?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: "No eligible churned clients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;

    for (const client of churned) {
      // Count candidates found since they left
      const { count } = await supabase
        .from("hire_alert_candidates")
        .select("id", { count: "exact", head: true })
        .gte("created_at", client.cancelled_at);

      const candidateCount = count || 0;
      if (candidateCount === 0) continue;

      // Get top 3 candidates
      const { data: topCandidates } = await supabase
        .from("hire_alert_candidates")
        .select("full_name, license_type, availability_score")
        .gte("created_at", client.cancelled_at)
        .order("availability_score", { ascending: false })
        .limit(3);

      const namesList = (topCandidates || []).map((c: any) => `${c.full_name} (${c.license_type}, ${c.availability_score}/10)`).join("\n");

      // Send SMS win-back
      if (client.phone) {
        const smsBody = `Hey ${client.company_name.split(" ")[0]}, since you left TechAlert, we found ${candidateCount} licensed candidates in your area:\n\n${namesList}\n\nCome back at $79/mo (locked-in discount):\nhttps://detroitwebagent.com/go/techalert?ref=winback&company=${encodeURIComponent(client.company_name)}\n\nReply STOP to opt out`;

        try {
          await sendSMS(supabase, {
            to: client.phone,
            body: smsBody,
            client_id: client.id,
            purpose: "winback_30day",
          });
          sent++;
        } catch { /* continue */ }
      }

      // Send email win-back
      if (client.email && RESEND_KEY) {
        const html = `
<div style="font-family:-apple-system,sans-serif;background:#0d1117;color:#e6edf3;padding:32px;">
  <div style="max-width:500px;margin:0 auto;background:#161b22;border:1px solid #30363d;border-radius:12px;padding:32px;">
    <h1 style="font-size:18px;margin:0 0 16px;">You've been missing out, ${client.company_name}</h1>
    <p style="color:#8b949e;font-size:13px;">Since you cancelled, we've found <strong style="color:#4493f8;">${candidateCount}</strong> licensed candidates in your area.</p>
    <div style="background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:16px;margin:16px 0;">
      ${(topCandidates || []).map((c: any) => `<p style="color:#e6edf3;font-size:13px;margin:4px 0;">${c.full_name} — ${c.license_type} (${c.availability_score}/10)</p>`).join("")}
      ${candidateCount > 3 ? `<p style="color:#8b949e;font-size:12px;margin:8px 0 0;">+${candidateCount - 3} more candidates</p>` : ""}
    </div>
    <a href="https://detroitwebagent.com/go/techalert?ref=winback" style="display:block;background:#3fb950;color:#fff;text-align:center;padding:12px;border-radius:6px;text-decoration:none;font-weight:700;">
      Reactivate at $79/mo (Special Rate)
    </a>
    <p style="color:#484f58;font-size:10px;text-align:center;margin-top:16px;">Detroit Web Agency · (313) 992-1219</p>
  </div>
</div>`;
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "TechAlert <alerts@detroitwebagent.com>",
              to: client.email,
              subject: `${candidateCount} candidates found since you left — ${client.company_name}`,
              html,
            }),
          });
        } catch { /* continue */ }
      }

      // Mark winback as sent
      await supabase
        .from("hire_alert_clients")
        .update({ winback_sent: new Date().toISOString() })
        .eq("id", client.id);
    }

    return new Response(JSON.stringify({ sent, eligible: churned.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
