import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PROFILE_URL = "https://www.mattmichelstraining.com/profile";

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[TRIAL-72H-WARNING] ${step}${d}`);
};

function buildEmailHtml(name: string, tierName: string, tierPrice: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a14;">
<tr><td align="center" style="padding:24px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
    <!-- M² Header -->
    <tr><td style="background:#f97316;padding:3px 0;"></td></tr>
    <tr><td style="text-align:center;padding:24px 0 16px;background:#0f0f1a;">
      <div style="font-size:32px;font-weight:900;color:#f97316;letter-spacing:3px;">M²</div>
      <div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:4px;margin-top:2px;">TRAINING</div>
      <div style="width:40px;height:2px;background:#f97316;margin:10px auto 0;"></div>
    </td></tr>

    <!-- Body -->
    <tr><td style="padding:24px;background:#0f0f1a;color:#ccc;font-size:15px;line-height:1.7;">
      <p style="color:#fff;font-size:17px;font-weight:bold;margin-top:0;">Hey ${name || "there"} —</p>

      <p>Quick heads-up: your <strong style="color:#f97316;">14-day free trial ends in 3 days</strong>.</p>

      <p>When it does, you'll automatically start the <strong style="color:#fff;">${tierName} membership at ${tierPrice}/month</strong>. That's the plan you selected when you started your trial. Your card on file will be charged on day 15.</p>

      <p><strong style="color:#fff;">Want to change plans or cancel?</strong> No hard feelings. You can switch tiers or cancel anytime from your profile — just click the link below before your trial ends.</p>

      <p style="text-align:center;margin:30px 0;">
        <a href="${PROFILE_URL}" style="display:inline-block;background:#f97316;color:#fff;padding:14px 28px;text-decoration:none;font-size:14px;font-weight:900;letter-spacing:2px;text-transform:uppercase;border-radius:6px;">Manage My Subscription</a>
      </p>

      <p>If you do nothing, your membership starts automatically and you keep everything — your logs, your programs, and Coach Matt's eyes on your training.</p>

      <p>See you in the portal,</p>
      <p style="margin-bottom:0;color:#fff;"><strong>Matt Michels</strong></p>
      <p style="margin-top:4px;color:#f97316;font-size:13px;font-weight:bold;">M² Training · Grosse Pointe, MI</p>
    </td></tr>

    <!-- Footer -->
    <tr><td style="background:#0a0a14;padding:20px;text-align:center;border-top:1px solid #222;">
      <div style="font-size:16px;font-weight:900;color:#f97316;letter-spacing:2px;">M²</div>
      <div style="font-size:10px;color:#444;margin-top:4px;">Matt Michel Strength & Conditioning</div>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find users whose trial started exactly 11 days ago (3 days before 14-day expiry)
    const now = new Date();
    const elevenDaysAgo = new Date(now);
    elevenDaysAgo.setDate(elevenDaysAgo.getDate() - 11);
    const twelveDaysAgo = new Date(now);
    twelveDaysAgo.setDate(twelveDaysAgo.getDate() - 12);

    const { data: trialUsers, error: queryErr } = await supabase
      .from("profiles")
      .select("user_id, email, full_name, athlete_name, trial_path, account_role")
      .gte("trial_started_at", twelveDaysAgo.toISOString())
      .lt("trial_started_at", elevenDaysAgo.toISOString())
      .not("email", "is", null);

    if (queryErr) throw queryErr;

    if (!trialUsers || trialUsers.length === 0) {
      logStep("No 72h warning users found");
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Found trial users", { count: trialUsers.length });

    // Filter out already subscribed users
    const userIds = trialUsers.map((u: any) => u.user_id);
    const { data: subscribers } = await supabase
      .from("subscriptions")
      .select("user_id")
      .in("user_id", userIds)
      .eq("status", "active");

    const subSet = new Set((subscribers || []).map((r: any) => r.user_id));

    // Check dedup via email_send_log
    const { data: alreadySent } = await supabase
      .from("email_send_log")
      .select("recipient_email")
      .eq("template_name", "trial_72h_warning")
      .in("recipient_email", trialUsers.filter((u: any) => u.email).map((u: any) => u.email));

    const sentSet = new Set((alreadySent || []).map((r: any) => r.recipient_email));

    const eligibleUsers = trialUsers.filter(
      (u: any) => !subSet.has(u.user_id) && u.email && !sentSet.has(u.email)
    );

    logStep("Eligible users after filtering", { count: eligibleUsers.length });

    let sentCount = 0;

    for (const user of eligibleUsers) {
      // Determine default tier based on account_role / trial_path
      const isParent = user.account_role === "parent" || user.trial_path === "parent";
      const tierName = isParent ? "M² Foundation" : "M² Basic";
      const tierPrice = isParent ? "$39.99" : "$14.99";
      const displayName = user.full_name || user.athlete_name || "";

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Matt Michels <matt@notify.m2training.com>",
            to: [user.email],
            subject: `Your M² trial ends in 3 days — here's what happens next`,
            html: buildEmailHtml(displayName, tierName, tierPrice),
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          logStep("Send failed", { email: user.email, error: errText });
          continue;
        }

        // Log for dedup
        await supabase.from("email_send_log").insert({
          recipient_email: user.email,
          template_name: "trial_72h_warning",
          status: "sent",
        });

        sentCount++;
        logStep("Email sent", { email: user.email, tier: tierName });
      } catch (emailErr) {
        logStep("Error sending", { email: user.email, error: String(emailErr) });
      }
    }

    return new Response(JSON.stringify({ sent: sentCount, total: trialUsers.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
