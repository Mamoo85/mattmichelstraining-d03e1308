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

const PRICING_URL = "https://www.mattmichelstraining.com/pricing";

const EMAIL_HTML = `
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
      <p style="color:#fff;font-size:17px;font-weight:bold;margin-top:0;">Hey —</p>

      <p>You've had almost two weeks to see how the M² system works.</p>

      <p>You know by now that we don't do fake influencer workouts or high-intensity circus acts. We do the unsexy, foundational work that builds absolute strength, fixes aching joints, and prevents injuries. Getting strong is hard, but it's an achievement nobody can ever take away from you.</p>

      <p><strong style="color:#f97316;">Tomorrow, your 14-day free trial expires and your selected plan begins.</strong> If you want to change your tier or review what you're getting, here are your options:</p>

      <ol style="padding-left:20px;">
        <li style="margin-bottom:8px;"><strong style="color:#fff;">The Foundation ($19.99/mo)</strong> — Full M² App, 85+ exercise library, Fix It rehab library, AI Generator, and progress logging.</li>
        <li style="margin-bottom:8px;"><strong style="color:#fff;">Pro · Semi-Custom ($149.99/mo)</strong> — Movement assessment, custom 4-week block, 2 weekly video form-checks, direct coach feedback.</li>
        <li style="margin-bottom:8px;"><strong style="color:#fff;">Elite · 1-on-1 ($349.99/mo)</strong> — Live video assessment, bespoke weekly programming, daily direct messaging with Matt.</li>
      </ol>

      <p>Don't lose the momentum you built this week.</p>

      <p style="text-align:center;margin:30px 0;">
        <a href="${PRICING_URL}" style="display:inline-block;background:#f97316;color:#fff;padding:14px 28px;text-decoration:none;font-size:14px;font-weight:900;letter-spacing:2px;text-transform:uppercase;border-radius:6px;">Review Your Plan</a>
      </p>

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find users whose trial started exactly 13 days ago (day before 14-day trial expires)
    const now = new Date();
    const thirteenDaysAgo = new Date(now);
    thirteenDaysAgo.setDate(thirteenDaysAgo.getDate() - 13);
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data: trialUsers, error: queryErr } = await supabase
      .from("profiles")
      .select("user_id, email, full_name, athlete_name")
      .gte("trial_started_at", fourteenDaysAgo.toISOString())
      .lt("trial_started_at", thirteenDaysAgo.toISOString())
      .not("email", "is", null);

    if (queryErr) throw queryErr;

    if (!trialUsers || trialUsers.length === 0) {
      console.log("No Day 13 trial users found.");
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter out already subscribed users and dedup
    const userIds = trialUsers.map((u: any) => u.user_id);

    const { data: subscribers } = await supabase
      .from("subscriptions")
      .select("user_id")
      .in("user_id", userIds)
      .eq("status", "active");

    const subSet = new Set((subscribers || []).map((r: any) => r.user_id));

    const { data: alreadySent } = await supabase
      .from("email_send_log")
      .select("recipient_email")
      .eq("template_name", "day13_conversion")
      .in("recipient_email", trialUsers.filter((u: any) => u.email).map((u: any) => u.email));

    const sentSet = new Set((alreadySent || []).map((r: any) => r.recipient_email));

    const eligibleUsers = trialUsers.filter(
      (u: any) => !subSet.has(u.user_id) && u.email && !sentSet.has(u.email)
    );

    console.log(`Found ${eligibleUsers.length} eligible Day 13 users out of ${trialUsers.length} total.`);

    let sentCount = 0;

    for (const user of eligibleUsers) {
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
            subject: "Your trial ends tomorrow. What's the plan?",
            html: EMAIL_HTML,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`Failed to send to ${user.email}: ${errText}`);
          continue;
        }

        // Log for dedup
        await supabase.from("email_send_log").insert({
          recipient_email: user.email,
          template_name: "day13_conversion",
          status: "sent",
        });

        sentCount++;
        console.log(`Day 13 email sent to ${user.email}`);
      } catch (emailErr) {
        console.error(`Error sending to ${user.email}:`, emailErr);
      }
    }

    return new Response(JSON.stringify({ sent: sentCount, total: trialUsers.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Day 13 email function error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
