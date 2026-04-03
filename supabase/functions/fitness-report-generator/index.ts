// fitness-report-generator — HTTP POST (trainer submits metrics) + cron 1st of month
// Generates personalized client progress reports, emails directly to client.
// Cron path: emails all trainers a reminder to submit metrics.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendReminderToTrainers(sb: ReturnType<typeof createClient>): Promise<string> {
  const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const { data: trainers, error } = await sb
    .from("fitness_trainers")
    .select("*")
    .eq("active", true);

  if (error || !trainers?.length) return "No active trainers found";

  let sent = 0;
  for (const trainer of trainers) {
    const { data: clients } = await sb
      .from("fitness_client_roster")
      .select("id, client_name, last_report_at")
      .eq("trainer_id", trainer.id)
      .eq("active", true);

    const pendingClients = (clients || []).filter((c) => {
      if (!c.last_report_at) return true;
      const lastReport = new Date(c.last_report_at);
      const daysSince = (Date.now() - lastReport.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince >= 28;
    });

    if (pendingClients.length === 0) continue;

    const clientList = pendingClients
      .map((c) => `<li>${c.client_name}</li>`)
      .join("");

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;max-width:650px;margin:0 auto;padding:20px;color:#1e293b;}
  h1{color:#e8621a;}
  .btn{display:inline-block;background:#e8621a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;}
</style></head>
<body>
<h1>Time to Submit Client Progress Reports!</h1>
<p>Hey ${trainer.name || "Coach"},</p>
<p>It's the start of a new month — time to send your clients their <strong>${month}</strong> progress reports!</p>
<p>You have <strong>${pendingClients.length} client(s)</strong> waiting for their report:</p>
<ul>${clientList}</ul>
<p>Submit each client's metrics through your dashboard and we'll automatically generate and send a beautiful, personalized progress report directly to each client.</p>
<a href="https://mattmichelstraining.com/trainer-dashboard" class="btn">Submit Client Metrics →</a>
<p style="margin-top:16px;color:#64748b;font-size:14px;">Your clients love seeing their progress documented — it's one of the best retention tools you have.</p>
<div class="footer">
  <img src="https://mattmichelstraining.com/images/matt-boat.jpg" style="width:48px;height:48px;border-radius:50%;vertical-align:middle;margin-right:8px;" alt="Matt">
  <span>Matt Michels | M² Performance Training | matt@mattmichelstraining.com | (313) 806-4952</span>
</div>
</body>
</html>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Matt Michels <matt@mattmichelstraining.com>",
        to: [trainer.email],
        subject: `📊 Time to Submit ${month} Client Progress Reports`,
        html,
      }),
    });
    sent++;
  }

  return `Reminders sent to ${sent} trainers`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Cron trigger: GET or POST with isCron flag
  const url = new URL(req.url);
  const isCron = url.searchParams.get("cron") === "true" ||
    req.headers.get("x-cron-trigger") === "true";

  if (isCron || req.method === "GET") {
    try {
      const result = await sendReminderToTrainers(sb);
      return new Response(JSON.stringify({ success: true, message: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // HTTP POST — trainer submitting client metrics
  try {
    const body = await req.json();
    const {
      trainerId,
      clientId,
      currentWeight,
      startWeight,
      bodyFatPct,
      benchPressMax,
      squatMax,
      notes,
      goalsAchieved,
    } = body as {
      trainerId: string;
      clientId: string;
      currentWeight?: number;
      startWeight?: number;
      bodyFatPct?: number;
      benchPressMax?: number;
      squatMax?: number;
      notes?: string;
      goalsAchieved?: string[];
    };

    if (!trainerId || !clientId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: trainerId, clientId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch trainer
    const { data: trainer, error: trainerErr } = await sb
      .from("fitness_trainers")
      .select("*")
      .eq("id", trainerId)
      .single();

    if (trainerErr || !trainer) {
      return new Response(
        JSON.stringify({ error: "Trainer not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch client from roster
    const { data: client, error: clientErr } = await sb
      .from("fitness_client_roster")
      .select("*")
      .eq("id", clientId)
      .eq("trainer_id", trainerId)
      .single();

    if (clientErr || !client) {
      return new Response(
        JSON.stringify({ error: "Client not found in trainer's roster" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const trainerName = trainer.name || "Your Trainer";
    const clientName = client.client_name || "Client";
    const clientEmail = client.client_email;

    // Build metrics comparison
    const weightChange =
      currentWeight && client.last_weight
        ? (currentWeight - client.last_weight).toFixed(1)
        : null;
    const totalWeightChange =
      currentWeight && startWeight ? (currentWeight - startWeight).toFixed(1) : null;

    const metricsContext = `
Current Weight: ${currentWeight ? `${currentWeight} lbs` : "not provided"}
Starting Weight: ${startWeight ? `${startWeight} lbs` : client.start_weight ? `${client.start_weight} lbs` : "not provided"}
Weight Change This Month: ${weightChange ? `${Number(weightChange) > 0 ? "+" : ""}${weightChange} lbs` : "N/A"}
Total Weight Change: ${totalWeightChange ? `${Number(totalWeightChange) > 0 ? "+" : ""}${totalWeightChange} lbs` : "N/A"}
Body Fat %: ${bodyFatPct ? `${bodyFatPct}%` : "not measured this month"}
Last Month Body Fat: ${client.last_body_fat_pct ? `${client.last_body_fat_pct}%` : "not on record"}
Bench Press Max: ${benchPressMax ? `${benchPressMax} lbs` : "not tested"}
Last Month Bench: ${client.last_bench_press ? `${client.last_bench_press} lbs` : "not on record"}
Squat Max: ${squatMax ? `${squatMax} lbs` : "not tested"}
Last Month Squat: ${client.last_squat_max ? `${client.last_squat_max} lbs` : "not on record"}
Goals Achieved This Month: ${goalsAchieved?.join(", ") || "none specified"}
Client's Overall Goal: ${client.goal || "general fitness improvement"}
Trainer Notes: ${notes || "No additional notes."}`;

    const prompt = `You are writing a personalized monthly fitness progress report FROM ${trainerName} TO their client ${clientName}.

MONTH: ${month}
${metricsContext}

Write a warm, motivating, professional progress report that:

1. Opens with a personalized congratulatory message specific to ${clientName}'s actual wins this month
2. Presents their stats in a clean comparison format (this month vs last month vs starting point)
3. Analyzes body composition trends (if data available)
4. Celebrates strength progress with specific numbers
5. Identifies 2-3 areas of excellence with genuine, specific praise
6. Suggests 2-3 focus areas for next month (framed positively, not as failures)
7. Closes with a motivational message personalized to their journey and goals

Tone: Warm, personal, encouraging. Sound like a coach who genuinely cares about ${clientName}. NOT corporate. NOT generic. Use their name naturally throughout.

FORMAT AS JSON:
{
  "reportHtml": "Full beautiful HTML report with clean layout, stats tables, and motivational design",
  "reportText": "Plain text version",
  "subjectLine": "Email subject line that will make ${clientName} excited to open it"
}`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const aiJson = await aiRes.json();
    const rawText = aiJson.content?.[0]?.text || "{}";

    let parsed: { reportHtml?: string; reportText?: string; subjectLine?: string } = {};
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      parsed = { reportHtml: rawText };
    }

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;color:#1e293b;}
  h1{color:#e8621a;}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;}
</style></head>
<body>
${parsed.reportHtml || `<p>Hi ${clientName},</p><pre>${parsed.reportText || rawText}</pre>`}
<div class="footer">
  <strong>${trainerName}</strong><br>
  Powered by M² Performance Training | matt@mattmichelstraining.com
</div>
</body>
</html>`;

    if (clientEmail) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${trainerName} <matt@mattmichelstraining.com>`,
          to: [clientEmail],
          subject: parsed.subjectLine || `Your ${month} Progress Report is Here, ${clientName}! 💪`,
          html: emailHtml,
        }),
      });
    }

    // Update fitness_client_roster
    await sb
      .from("fitness_client_roster")
      .update({
        last_report_at: new Date().toISOString(),
        last_weight: currentWeight || client.last_weight,
        last_body_fat_pct: bodyFatPct || client.last_body_fat_pct,
        last_bench_press: benchPressMax || client.last_bench_press,
        last_squat_max: squatMax || client.last_squat_max,
        start_weight: client.start_weight || startWeight,
      })
      .eq("id", clientId);

    // Increment trainer's reports_sent
    await sb
      .from("fitness_trainers")
      .update({ reports_sent: (trainer.reports_sent || 0) + 1 })
      .eq("id", trainerId);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("fitness-report-generator error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
