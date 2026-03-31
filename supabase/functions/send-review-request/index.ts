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

// Google Business Profile review link for M² Training
const GBP_REVIEW_URL = "https://g.page/r/m2training/review";

const log = (msg: string, data?: any) => {
  const d = data ? ` — ${JSON.stringify(data)}` : "";
  console.log(`[SEND-REVIEW-REQUEST] ${msg}${d}`);
};

function buildReviewEmailHtml(name: string, triggerType: string): string {
  const isFirstPR = triggerType === "first_pr";
  const headline = isFirstPR
    ? `You just hit a new PR — that's worth sharing.`
    : `30 days in. Here's a quick favor.`;
  const body = isFirstPR
    ? `You just logged a personal record. That kind of progress is exactly what this is all about.<br><br>
       I'd love it if you'd take 30 seconds to leave a quick Google review — it helps other athletes find M² Training and decide to make the same commitment you did.`
    : `You've been training with M² for a month now. I hope you've felt the difference.<br><br>
       If you have, I'd really appreciate a quick Google review. It takes about 30 seconds and means everything for helping other local athletes find this program.`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a14;">
<tr><td align="center" style="padding:24px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
    <tr><td style="background:#f97316;padding:3px 0;"></td></tr>
    <tr><td style="text-align:center;padding:24px 0 16px;background:#0f0f1a;">
      <div style="font-size:32px;font-weight:900;color:#f97316;letter-spacing:3px;">M²</div>
      <div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:4px;margin-top:2px;">TRAINING</div>
      <div style="width:40px;height:2px;background:#f97316;margin:10px auto 0;"></div>
    </td></tr>
    <tr><td style="padding:24px;background:#0f0f1a;color:#ccc;font-size:15px;line-height:1.7;">
      <p style="color:#fff;font-size:17px;font-weight:bold;margin-top:0;">Hey ${name || "there"} —</p>
      <p>${headline}</p>
      <p>${body}</p>
      <p style="text-align:center;margin:30px 0;">
        <a href="${GBP_REVIEW_URL}" style="display:inline-block;background:#f97316;color:#fff;padding:14px 28px;text-decoration:none;font-size:14px;font-weight:900;letter-spacing:2px;text-transform:uppercase;border-radius:6px;">Leave a Google Review</a>
      </p>
      <p>It literally only takes 30 seconds — you can even just click 5 stars and move on. That alone helps more than you know.</p>
      <p>Thanks for being part of this.</p>
      <p style="margin-bottom:0;color:#fff;"><strong>— Coach Matt</strong></p>
      <p style="margin-top:4px;color:#f97316;font-size:13px;font-weight:bold;">M² Training · Grosse Pointe, MI</p>
    </td></tr>
    <tr><td style="background:#0a0a14;padding:20px;text-align:center;border-top:1px solid #222;">
      <div style="font-size:16px;font-weight:900;color:#f97316;letter-spacing:2px;">M²</div>
      <div style="font-size:10px;color:#444;margin-top:4px;">Matt Michels Strength & Conditioning</div>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

async function sendReviewEmail(
  sb: any,
  userId: string,
  email: string,
  name: string,
  triggerType: string
): Promise<boolean> {
  // Check suppressed_emails
  const { data: suppressed } = await sb
    .from("suppressed_emails")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (suppressed) {
    log("Suppressed email skipped", { email });
    return false;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Matt Michels <matt@mattmichelstraining.com>",
      to: [email],
      subject: triggerType === "first_pr"
        ? "New PR — quick favor from Coach Matt"
        : "30 days in — quick favor from Coach Matt",
      html: buildReviewEmailHtml(name, triggerType),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    log("Send failed", { email, error: errText });
    return false;
  }

  // Log to review_request_log
  await sb.from("review_request_log" as any).insert({
    user_id: userId,
    trigger_type: triggerType,
    recipient_email: email,
  });

  log("Sent", { email, triggerType });
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    let totalSent = 0;

    // ── PASS 1: Day-30 subscribers ──────────────────────────────────────────
    const day31 = new Date(now);
    day31.setDate(day31.getDate() - 31);
    const day29 = new Date(now);
    day29.setDate(day29.getDate() - 29);

    const { data: day30Users } = await sb
      .from("profiles")
      .select("user_id, email, full_name, athlete_name, subscription_tier")
      .gte("created_at", day31.toISOString())
      .lt("created_at", day29.toISOString())
      .not("email", "is", null)
      .not("subscription_tier", "in", '("free","")');

    if (day30Users && day30Users.length > 0) {
      const emails = day30Users.map((u: any) => u.email).filter(Boolean);

      // Check who already received day_30
      const { data: alreadySent } = await sb
        .from("review_request_log" as any)
        .select("recipient_email")
        .eq("trigger_type", "day_30")
        .in("recipient_email", emails);

      const sentSet = new Set((alreadySent || []).map((r: any) => r.recipient_email));
      const eligible = day30Users.filter((u: any) => u.email && !sentSet.has(u.email));

      log("Day-30 eligible", { count: eligible.length });

      for (const user of eligible) {
        const name = user.full_name || user.athlete_name || "";
        const sent = await sendReviewEmail(sb, user.user_id, user.email, name, "day_30");
        if (sent) totalSent++;
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    // ── PASS 2: First PR submissions (< 24h old) ────────────────────────────
    const oneDayAgo = new Date(now);
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    const { data: recentPRs } = await sb
      .from("pr_submissions" as any)
      .select("user_id, created_at")
      .gte("created_at", oneDayAgo.toISOString())
      .eq("status", "approved");

    if (recentPRs && recentPRs.length > 0) {
      const userIds = [...new Set(recentPRs.map((p: any) => p.user_id))];

      // Get profiles
      const { data: profiles } = await sb
        .from("profiles")
        .select("user_id, email, full_name, athlete_name")
        .in("user_id", userIds)
        .not("email", "is", null);

      if (profiles && profiles.length > 0) {
        const profileEmails = profiles.map((p: any) => p.email).filter(Boolean);

        const { data: alreadySent } = await sb
          .from("review_request_log" as any)
          .select("recipient_email")
          .eq("trigger_type", "first_pr")
          .in("recipient_email", profileEmails);

        const sentSet = new Set((alreadySent || []).map((r: any) => r.recipient_email));
        const eligible = profiles.filter((p: any) => p.email && !sentSet.has(p.email));

        log("First-PR eligible", { count: eligible.length });

        for (const user of eligible) {
          const name = user.full_name || user.athlete_name || "";
          const sent = await sendReviewEmail(sb, user.user_id, user.email, name, "first_pr");
          if (sent) totalSent++;
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    }

    log("Done", { totalSent });

    return new Response(JSON.stringify({ sent: totalSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[SEND-REVIEW-REQUEST] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
