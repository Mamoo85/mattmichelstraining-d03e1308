/**
 * remote-control — Secure remote command endpoint for M² agents.
 *
 * Matt (or n8n) POSTs to this function to trigger any M² agent/action
 * from anywhere — phone, automation, Zapier, etc.
 *
 * Auth: Bearer token via REMOTE_CONTROL_SECRET env var.
 *
 * POST body: { "command": "oracle" | "tom" | "pulse" | "status" | "<custom prompt>" }
 * Results are emailed to Matt and returned in the response.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REMOTE_CONTROL_SECRET = Deno.env.get("REMOTE_CONTROL_SECRET") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash-lite";

const MATT_EMAIL = "matt@mattmichelstraining.com";

// ── Built-in command prompts ──────────────────────────────────────────────────

const COMMANDS: Record<string, string> = {
  oracle: `You are Oracle, the M² account watchdog. Query the following Supabase tables and identify:
1. Any SMS product clients with 0 sends in the last 7 days (check: sms_blast_clients, noshow_clients, estimate_drip_clients, invoice_chaser_clients, afterjob_drip_clients, slow_day_clients)
2. Any clients with active subscriptions but missing required config fields (phone, business_name)
3. Any Stripe webhook events that may have failed (stripe_events table if exists)

Return a concise health report with: ✅ healthy items, ⚠️ warnings, and 🔴 critical issues.
Format as a plain HTML email summary Matt can act on.`,

  tom: `You are Tom, the M² lead hunter. Generate a prospecting action plan for today:
1. List the top 3 local contractor niches to target this week (roofing, HVAC, plumbing, electrical, landscaping)
2. Suggest 5 outreach message variants for the web design service ($499-$3,499)
3. Identify any GBP SaaS or Review Monitor upsell opportunities for existing contractor clients

Keep it concise and actionable. Format as HTML.`,

  pulse: `You are Pulse, the SMS product health monitor for M². Provide a status check on all 10 SMS/monitoring products:
- Review Monitor ($25/mo)
- Weekly SMS Blast ($19/mo)
- No-Show Re-Booker ($25/mo)
- Estimate Follow-Up Drip ($39/mo)
- Invoice Chaser ($29/mo)
- After-Job Drip ($29/mo)
- Seasonal Promo Blaster ($29/mo)
- Referral Program ($39/mo)
- Slow Day SMS ($25/mo)
- New Homeowner Campaign ($59/mo)

For each: status (active/needs attention), potential MRR if sold to 10 clients, and one quick win to acquire a new client this week.
Format as an HTML table.`,

  status: `You are the M² system monitor. Provide a concise daily status briefing covering:
1. Revenue streams: which products are live and generating (list the 17 active products)
2. Automation health: cron jobs running (contractor leads 15min, GBP 3x/week, newsletter Monday 8am, etc.)
3. Today's action items for Matt (should be ≤3 items — return calls, respond to leads, etc.)
4. One growth opportunity to pursue this week

Format as a clean HTML email Matt can read in 60 seconds.`,
};

// ── Email helper ──────────────────────────────────────────────────────────────

async function notifyMatt(subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "M² Remote Control <matt@mattmichelstraining.com>",
      to: [MATT_EMAIL],
      bcc: ["matthewmichels4@gmail.com"],
      subject,
      html,
    }),
  });
}

// ── AI runner ─────────────────────────────────────────────────────────────────

async function runPrompt(prompt: string): Promise<string> {
  if (!LOVABLE_API_KEY) return "Error: AI gateway not configured.";

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[remote-control] AI error ${res.status}: ${err}`);
    return `AI error: ${res.status}`;
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "No response.";
}

// ── Log to DB ─────────────────────────────────────────────────────────────────

async function logCommand(command: string, result: string): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  await sb.from("remote_control_log").insert({
    command,
    result_snippet: result.slice(0, 500),
    executed_at: new Date().toISOString(),
  });
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Auth ──
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!REMOTE_CONTROL_SECRET || token !== REMOTE_CONTROL_SECRET) {
    console.warn("[remote-control] Unauthorized attempt");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Parse body ──
  let command = "status";
  try {
    const body = await req.json();
    command = (body?.command || "status").toString().trim().toLowerCase();
  } catch {
    // default to status
  }

  console.log(`[remote-control] Running command: "${command}"`);

  // ── Resolve prompt ──
  const prompt = COMMANDS[command] ?? `You are the M² system assistant. The user sent this command: "${command}"\n\nRespond helpfully and concisely as if you are Matt's AI chief of staff. Format your response as HTML.`;

  // ── Run ──
  const result = await runPrompt(prompt);

  const subject = `M² Remote: ${command.charAt(0).toUpperCase() + command.slice(1)} Report`;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#1e293b;padding:16px 24px;border-radius:8px 8px 0 0;">
        <h2 style="color:#e8621a;margin:0;font-size:18px;">M² Remote Control</h2>
        <p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">Command: <strong style="color:#fff;">${command}</strong> · ${new Date().toLocaleString("en-US", { timeZone: "America/Detroit" })} ET</p>
      </div>
      <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-radius:0 0 8px 8px;">
        ${result}
      </div>
    </div>
  `;

  // Fire email and log in parallel — don't block response
  await Promise.all([
    notifyMatt(subject, html),
    logCommand(command, result),
  ]);

  return new Response(
    JSON.stringify({ ok: true, command, result }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
});
