/**
 * remote-control — Secure remote command endpoint for M² agents.
 *
 * Matt (or n8n) POSTs to this function to trigger any M² agent/action
 * from anywhere — phone, automation, Zapier, etc.
 *
 * Auth: Bearer token via REMOTE_CONTROL_SECRET env var.
 *
 * POST body: { "command": "oracle" | "tom" | "pulse" | "status" | "help" | ... , "source": "phone" }
 * Results are emailed to Matt and returned in the response.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateText } from "../_shared/ai.ts";

const REMOTE_CONTROL_SECRET = Deno.env.get("REMOTE_CONTROL_SECRET") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const MATT_EMAIL = "matt@mattmichelstraining.com";

// ── Built-in command prompts ──────────────────────────────────────────────────

const COMMANDS: Record<string, { label: string; prompt: string }> = {
  help: {
    label: "Available Commands",
    prompt: "", // handled separately
  },

  status: {
    label: "System Status",
    prompt: `You are the M² system monitor. Provide a concise daily status briefing covering:
1. Revenue streams: which products are live and generating (list the 17+ active products)
2. Automation health: cron jobs running (contractor leads 15min, GBP 3x/week, newsletter Monday 8am, etc.)
3. Today's action items for Matt (should be ≤3 items — return calls, respond to leads, etc.)
4. One growth opportunity to pursue this week

Format as clean HTML Matt can read in 60 seconds.`,
  },

  oracle: {
    label: "Account Watchdog",
    prompt: `You are Oracle, the M² account watchdog. Query the following Supabase tables and identify:
1. Any SMS product clients with 0 sends in the last 7 days (check: sms_blast_clients, noshow_clients, estimate_drip_clients, invoice_chaser_clients, afterjob_drip_clients, slow_day_clients)
2. Any clients with active subscriptions but missing required config fields (phone, business_name)
3. Any Stripe webhook events that may have failed (stripe_events table if exists)

Return a concise health report with: ✅ healthy items, ⚠️ warnings, and 🔴 critical issues.
Format as plain HTML email summary Matt can act on.`,
  },

  tom: {
    label: "Lead Hunter",
    prompt: `You are Tom, the M² lead hunter. Generate a prospecting action plan for today:
1. List the top 3 local contractor niches to target this week (roofing, HVAC, plumbing, electrical, landscaping)
2. Suggest 5 outreach message variants for the web design service ($499-$3,499)
3. Identify any GBP SaaS or Review Monitor upsell opportunities for existing contractor clients

Keep it concise and actionable. Format as HTML.`,
  },

  pulse: {
    label: "SMS Health Monitor",
    prompt: `You are Pulse, the SMS product health monitor for M². Provide a status check on all 10 SMS/monitoring products:
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
  },

  revenue: {
    label: "Revenue Snapshot",
    prompt: `You are Rev, the M² revenue operations agent. Generate a revenue snapshot:
1. List all product lines with their monthly pricing
2. Calculate total potential MRR if each product had just 5 clients
3. Identify the top 3 highest-margin products Matt should push this week
4. Flag any products that are live but have $0 MRR (zero clients)

Group by: DWA Suite (FieldDesk $199, SiteRadar $49, TechAlert $99), SMS Products (10 products $19-$59), High-Ticket (Reg Filing $497, Bid Intel $599), Core (Contractor Leads $399, Social Media AI $199-$299, Web Design $499-$3,499).
Format as an HTML summary with a total MRR line at the bottom.`,
  },

  dwa: {
    label: "Detroit Web Agency Status",
    prompt: `You are the Detroit Web Agency operations monitor. Report on the DWA product suite:

1. **FieldDesk** ($199/mo) — CRM for field service companies (HVAC, plumbing, boiler). Dispatch board, GPS tech map, mobile app.
2. **SiteRadar** ($49/mo) — Visitor intelligence via IP reverse lookup. Shows which businesses visit client websites.
3. **TechAlert** ($99/mo) — Hiring monitor scanning MIOSHA licenses, Apollo, job boards for available tradespeople.

For each product:
- Current pitch angle and ideal target customer
- One cold outreach message Matt can send today
- Bundle pricing (standalone vs. with website)

Also list the 6 DWA add-ons with bundled pricing (20% off with website).
Format as HTML with DWA branding (dark teal #00d4ff on dark background).`,
  },

  shield: {
    label: "Churn Prevention",
    prompt: `You are Shield, the M² churn prevention monitor. Identify churn risks:
1. Which product types are most likely to churn and why (common objections)
2. For each active product line, suggest one proactive retention action
3. Draft a "check-in" email template Matt can send to any client showing low engagement
4. List warning signs that a client is about to cancel (missed payments, no logins, no opens)

Format as actionable HTML with red/yellow/green risk indicators.`,
  },

  comply: {
    label: "Compliance Check",
    prompt: `You are Comply, the M² compliance auditor. Run a compliance check across:
1. **TCPA/SMS**: Are we querying sms_opt_outs before every Twilio send? Any recent opt-outs we need to honor?
2. **CAN-SPAM**: Do all marketing emails have unsubscribe links and physical address?
3. **Stripe**: Are all checkout sessions using inline price_data with metadata.type set?
4. **Data Privacy**: Any PII being logged that shouldn't be? Any tables missing RLS?

Return a compliance scorecard: ✅ compliant, ⚠️ needs review, 🔴 violation.
Format as HTML.`,
  },

  scout: {
    label: "Competitive Intel",
    prompt: `You are Scout, the M² competitive intelligence monitor. Analyze the competitive landscape:
1. List 3 competitors for each DWA product (FieldDesk vs. ServiceTitan/Housecall Pro/Jobber, SiteRadar vs. RB2B/Leadfeeder, TechAlert vs. Indeed/ZipRecruiter)
2. Our pricing advantage vs. each competitor
3. One feature or angle that differentiates M² from each
4. Any new market entrants or pricing changes to watch

Format as HTML comparison table.`,
  },

  upsell: {
    label: "Upsell Opportunities",
    prompt: `You are Upsell, the M² cross-sell identifier. Based on the product catalog:
1. For a FieldDesk client ($199/mo): suggest the natural add-ons (SiteRadar, TechAlert, Review Monitor, After-Job Drip)
2. For a web design client ($499-$3,499): suggest the retainer stack (GBP $99/mo, Social Media $199/mo, SMS products)
3. For a contractor lead gen client ($399/mo): suggest the full automation stack
4. Draft a "bundle upgrade" email offering 20% off add-ons

Calculate the revenue lift for each upsell path.
Format as HTML with pricing tables.`,
  },

  launch: {
    label: "Go-To-Market Plan",
    prompt: `You are Launch, the M² go-to-market orchestrator. Create a launch checklist for the next product push:
1. Pre-launch: landing page live, checkout flow tested, welcome email configured, admin CRM entry added
2. Launch day: social posts drafted, email blast to newsletter list, Tom prospecting activated
3. Week 1: follow up on leads, collect testimonials, adjust pricing if needed
4. Month 1: review MRR, identify top acquisition channel, optimize funnel

Make it specific to DWA products (FieldDesk, SiteRadar, TechAlert).
Format as HTML checklist with checkboxes.`,
  },
};

// ── Help command builder ─────────────────────────────────────────────────────

function buildHelpHTML(): string {
  const rows = Object.entries(COMMANDS)
    .filter(([k]) => k !== "help")
    .map(
      ([cmd, { label }]) =>
        `<tr><td style="padding:8px 16px;font-family:monospace;font-weight:bold;color:#e8621a;">${cmd}</td><td style="padding:8px 16px;color:#cbd5e1;">${label}</td></tr>`
    )
    .join("");

  return `
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr><th style="text-align:left;padding:8px 16px;color:#94a3b8;border-bottom:1px solid #334155;">Command</th><th style="text-align:left;padding:8px 16px;color:#94a3b8;border-bottom:1px solid #334155;">Description</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#94a3b8;font-size:13px;margin-top:16px;">Send any custom text as the command to get a free-form AI response.</p>
  `;
}

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

// ── Log to DB ─────────────────────────────────────────────────────────────────

async function logCommand(
  command: string,
  result: string,
  source: string
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  await sb.from("remote_control_log").insert({
    command,
    result_snippet: result.slice(0, 500),
    source,
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
  let source = "api";
  try {
    const body = await req.json();
    command = (body?.command || "status").toString().trim().toLowerCase();
    source = (body?.source || "api").toString().trim();
  } catch {
    // default to status
  }

  console.log(`[remote-control] Running command: "${command}" (source: ${source})`);

  // ── Handle help ──
  if (command === "help") {
    const helpHtml = buildHelpHTML();
    const wrappedHtml = wrapEmail("help", "Available Commands", helpHtml);

    await Promise.all([
      notifyMatt("M² Remote: Available Commands", wrappedHtml),
      logCommand("help", "Listed all commands", source),
    ]);

    return new Response(
      JSON.stringify({
        ok: true,
        command: "help",
        commands: Object.entries(COMMANDS)
          .filter(([k]) => k !== "help")
          .map(([cmd, { label }]) => ({ cmd, label })),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  // ── Resolve prompt ──
  const entry = COMMANDS[command];
  const prompt = entry
    ? entry.prompt
    : `You are the M² system assistant. The user sent this command: "${command}"\n\nRespond helpfully and concisely as if you are Matt's AI chief of staff. Format your response as HTML.`;

  const label = entry?.label || "Custom Command";

  // ── Run ──
  const result = await generateText(prompt, 1200);

  if (!result) {
    return new Response(
      JSON.stringify({ ok: false, command, error: "AI returned empty response" }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  const html = wrapEmail(command, label, result);

  const subject = `M² Remote: ${label}`;

  // Fire email and log in parallel
  await Promise.all([
    notifyMatt(subject, html),
    logCommand(command, result, source),
  ]);

  return new Response(
    JSON.stringify({ ok: true, command, label, result }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
});

// ── Email wrapper ─────────────────────────────────────────────────────────────

function wrapEmail(command: string, label: string, body: string): string {
  const now = new Date().toLocaleString("en-US", { timeZone: "America/Detroit" });
  return `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;">
      <div style="background:#1e293b;padding:16px 24px;border-radius:8px 8px 0 0;">
        <h2 style="color:#e8621a;margin:0;font-size:18px;">M² Remote Control</h2>
        <p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">
          <strong style="color:#fff;">${label}</strong> · <code style="color:#e8621a;">${command}</code> · ${now} ET
        </p>
      </div>
      <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-radius:0 0 8px 8px;line-height:1.6;">
        ${body}
      </div>
      <p style="text-align:center;color:#64748b;font-size:11px;margin-top:12px;">
        Reply "help" for all commands · Powered by M² Automation
      </p>
    </div>
  `;
}
