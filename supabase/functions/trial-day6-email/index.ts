import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PRICING_URL = "https://m2training.lovable.app/pricing";

const EMAIL_HTML = `
<div style="font-family: Georgia, 'Times New Roman', serif; max-width: 580px; margin: 0 auto; padding: 20px; color: #1a1a1a; line-height: 1.7;">
  <p>Hey —</p>

  <p>You've had six days to see how the M² system works.</p>

  <p>You know by now that we don't do fake influencer workouts or high-intensity circus acts. We do the unsexy, foundational work that builds absolute strength, fixes aching joints, and prevents injuries. Getting strong is hard, but it's an achievement nobody can ever take away from you.</p>

  <p><strong>Tomorrow, your 14-day free access expires.</strong> If you want to keep your logs, keep progressing, and keep my eyes on your training, you need to choose your path:</p>

  <ol style="padding-left: 20px;">
    <li style="margin-bottom: 8px;"><strong>M² Basic ($12.99/mo)</strong> — Unlocks the full Exercise Library and workout logging so you can keep building your foundation.</li>
    <li style="margin-bottom: 8px;"><strong>M² Pro ($25.99/mo)</strong> — Adds custom programming and the 'Fix It' mobility library.</li>
    <li style="margin-bottom: 8px;"><strong>M² Elite ($42.99/mo)</strong> — The full coaching experience. You get the 'Flag Coach Matt' button. Upload your videos, and I will personally review your form to make sure you are moving safely and effectively.</li>
  </ol>

  <p>Don't lose the momentum you built this week.</p>

  <p style="text-align: center; margin: 30px 0;">
    <a href="${PRICING_URL}" style="display: inline-block; background-color: #1a1a1a; color: #ffffff; padding: 14px 28px; text-decoration: none; font-size: 14px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">Choose Your Plan &amp; Keep Training</a>
  </p>

  <p>See you in the portal,</p>
  <p style="margin-bottom: 0;"><strong>Matt Michels</strong></p>
  <p style="margin-top: 4px; color: #666; font-size: 14px;">M² Training</p>
</div>
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

    // Get profiles with trial_started_at between 7 and 6 days ago
    const { data: trialUsers, error: queryErr } = await supabase
      .from("profiles")
      .select("user_id, email, full_name, athlete_name")
      .gte("trial_started_at", sevenDaysAgo.toISOString())
      .lt("trial_started_at", sixDaysAgo.toISOString())
      .not("email", "is", null);

    if (queryErr) throw queryErr;

    if (!trialUsers || trialUsers.length === 0) {
      console.log("No Day 6 trial users found.");
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter out users who already received this email or are subscribed
    const userIds = trialUsers.map((u) => u.user_id);

    const { data: alreadySent } = await supabase
      .from("trial_emails_sent")
      .select("user_id")
      .in("user_id", userIds)
      .eq("email_type", "day6_conversion");

    const sentSet = new Set((alreadySent || []).map((r) => r.user_id));

    // Also check for active subscriptions
    const { data: subscribers } = await supabase
      .from("subscriptions")
      .select("user_id")
      .in("user_id", userIds)
      .eq("status", "active");

    const subSet = new Set((subscribers || []).map((r) => r.user_id));

    const eligibleUsers = trialUsers.filter(
      (u) => !sentSet.has(u.user_id) && !subSet.has(u.user_id) && u.email
    );

    console.log(`Found ${eligibleUsers.length} eligible Day 6 users out of ${trialUsers.length} total.`);

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
            from: "Matt Michels <matt@m2training.lovable.app>",
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

        // Log successful send for dedup
        await supabase.from("trial_emails_sent").insert({
          user_id: user.user_id,
          email_type: "day6_conversion",
        });

        sentCount++;
        console.log(`Day 6 email sent to ${user.email}`);
      } catch (emailErr) {
        console.error(`Error sending to ${user.email}:`, emailErr);
      }
    }

    return new Response(JSON.stringify({ sent: sentCount, total: trialUsers.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Day 6 email function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
