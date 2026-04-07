// drill-content-monitor — Content pipeline health monitor
// Checks GBP posts, social posts, newsletter, daily workouts for gaps/failures
// Cron: daily 3pm UTC (11am ET)
// Agent: Drill

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const MATT_EMAIL = "matt@mattmichelstraining.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface ContentIssue {
  pipeline: string;
  severity: "critical" | "warning";
  description: string;
}

async function checkGbpPosts(): Promise<ContentIssue[]> {
  const issues: ContentIssue[] = [];
  // Check if any GBP clients haven't had a post in 5+ days
  const cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const { data: clients } = await supabase
    .from("gbp_saas_clients")
    .select("id, business_name, last_post_at")
    .eq("active", true)
    .or(`last_post_at.lt.${cutoff},last_post_at.is.null`);

  if (clients && clients.length > 0) {
    issues.push({
      pipeline: "GBP Posts",
      severity: clients.length >= 3 ? "critical" : "warning",
      description: `${clients.length} GBP client${clients.length > 1 ? "s" : ""} have not received a post in 5+ days: ${clients.map((c: any) => c.business_name || c.id).slice(0, 3).join(", ")}${clients.length > 3 ? ` +${clients.length - 3} more` : ""}`,
    });
  }
  return issues;
}

async function checkSocialPosts(): Promise<ContentIssue[]> {
  const issues: ContentIssue[] = [];
  const cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const { data: clients } = await supabase
    .from("social_media_clients")
    .select("id, business_name, last_post_at")
    .eq("active", true)
    .or(`last_post_at.lt.${cutoff},last_post_at.is.null`);

  if (clients && clients.length > 0) {
    issues.push({
      pipeline: "Social Media",
      severity: clients.length >= 3 ? "critical" : "warning",
      description: `${clients.length} social media client${clients.length > 1 ? "s" : ""} have not received posts in 5+ days`,
    });
  }
  return issues;
}

async function checkNewsletter(): Promise<ContentIssue[]> {
  const issues: ContentIssue[] = [];
  // Check if newsletter was sent in the last 8 days (should run weekly)
  const cutoff = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const { data: sends } = await supabase
    .from("newsletter_sends")
    .select("id, sent_at")
    .gte("sent_at", cutoff)
    .limit(1);

  if (!sends || sends.length === 0) {
    issues.push({
      pipeline: "Newsletter",
      severity: "warning",
      description: "No newsletter sent in the last 8 days — check newsletter-send cron",
    });
  }
  return issues;
}

async function checkDailyWorkouts(): Promise<ContentIssue[]> {
  const issues: ContentIssue[] = [];
  // Check if any workouts were published today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data: workouts } = await supabase
    .from("workouts")
    .select("id")
    .eq("published", true)
    .gte("created_at", today.toISOString())
    .limit(1);

  if (!workouts || workouts.length === 0) {
    issues.push({
      pipeline: "Daily Workouts",
      severity: "warning",
      description: "No workout published today — generate-daily-workouts cron may have failed",
    });
  }
  return issues;
}

async function sendDrillAlert(issues: ContentIssue[]): Promise<void> {
  const critical = issues.filter((i) => i.severity === "critical");
  if (critical.length === 0) return;

  const rows = critical
    .map(
      (i) =>
        `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #334155"><strong>${i.pipeline}</strong></td>
          <td style="padding:6px 12px;border-bottom:1px solid #334155;color:#ef4444">${i.description}</td>
        </tr>`
    )
    .join("");

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "M² Drill <matt@mattmichelstraining.com>",
      to: [MATT_EMAIL],
      subject: `🚨 DRILL ALERT: ${critical.length} content pipeline issue${critical.length > 1 ? "s" : ""} detected`,
      html: `
        <div style="font-family:sans-serif;background:#0f172a;color:#f8fafc;padding:24px;border-radius:12px">
          <h2 style="color:#ef4444;margin:0 0 8px">Content Pipeline Alert</h2>
          <p style="color:#94a3b8;margin:0 0 20px">Drill detected <strong>${critical.length} critical issue${critical.length > 1 ? "s" : ""}</strong> in the content delivery pipeline.</p>
          <table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden">
            <thead><tr style="background:#334155">
              <th style="padding:8px 12px;text-align:left">Pipeline</th>
              <th style="padding:8px 12px;text-align:left">Issue</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="color:#94a3b8;margin:20px 0 0;font-size:12px">Check edge function logs in Supabase → Functions → Logs</p>
        </div>`,
    }),
  });
}

async function updateHeartbeat(status: "ok" | "error") {
  await supabase.from("agent_heartbeats").upsert({
    agent_name: "drill",
    last_run_at: new Date().toISOString(),
    last_status: status,
  });
}

Deno.serve(async () => {
  try {
    console.log("[drill-content-monitor] Starting content pipeline sweep");

    const [gbpIssues, socialIssues, newsletterIssues, workoutIssues] = await Promise.all([
      checkGbpPosts(),
      checkSocialPosts(),
      checkNewsletter(),
      checkDailyWorkouts(),
    ]);

    const allIssues = [...gbpIssues, ...socialIssues, ...newsletterIssues, ...workoutIssues];

    if (allIssues.length > 0) {
      await sendDrillAlert(allIssues);
    }

    const critical = allIssues.filter((i) => i.severity === "critical").length;
    const warnings = allIssues.filter((i) => i.severity === "warning").length;

    await updateHeartbeat("ok");
    console.log(`[drill-content-monitor] Done: ${critical} critical, ${warnings} warnings`);

    return new Response(JSON.stringify({ ok: true, critical, warnings, total: allIssues.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[drill-content-monitor] Error:", err);
    await updateHeartbeat("error");
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
