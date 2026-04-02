// OBI-WAN INTEGRITY — Weekly Product Health Guardian
// Runs every Sunday 6am ET. Checks all 12 active products for delivery failures,
// stuck orders, and cron health. Emails Matt a pass/fail report.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const MATT = "matt@mattmichelstraining.com";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface ProductCheck {
  id: string;
  name: string;
  type: "instant" | "subscription";
  orderTable?: string;
  cronDescription?: string;
  expectedCronHoursAgo?: number; // max hours since last cron run before warning
}

const PRODUCTS: ProductCheck[] = [
  // Instant delivery — check for stuck pending orders and recent failures
  { id: "website_audit", name: "Website Audit", type: "instant", orderTable: "audit_orders" },
  { id: "gbp_post_pack", name: "GBP Post Pack", type: "instant", orderTable: "gbp_post_packs" },
  { id: "competitor_report", name: "Competitor Report", type: "instant", orderTable: "competitor_reports" },
  // Subscriptions — check delivery_failures + cron activity
  { id: "gbp_saas_subscription", name: "GBP SaaS", type: "subscription", orderTable: "gbp_saas_clients", cronDescription: "Mon/Wed/Fri 10am ET", expectedCronHoursAgo: 96 },
  { id: "social_media_subscription", name: "Social Media AI", type: "subscription", orderTable: "social_media_clients", cronDescription: "Mon/Wed/Fri 3pm ET", expectedCronHoursAgo: 96 },
  { id: "field_rep_subscription", name: "Field Rep Tools", type: "subscription", orderTable: "b2b_subscribers" },
  { id: "contractor_lead_subscription", name: "Contractor Leads", type: "subscription", orderTable: "contractor_clients", cronDescription: "Every 15 min", expectedCronHoursAgo: 1 },
  { id: "b2b_database_subscription", name: "B2B Database", type: "subscription", orderTable: "b2b_subscribers", cronDescription: "Daily 6am ET", expectedCronHoursAgo: 30 },
  { id: "review_responder_subscription", name: "Review Responder", type: "subscription", orderTable: "review_responder_clients" },
  { id: "seo_report_subscription", name: "SEO Reports", type: "subscription", orderTable: "seo_report_clients" },
  { id: "chatbot_subscription", name: "AI Chatbot", type: "subscription", orderTable: "chatbot_clients" },
  { id: "missed_call_subscription", name: "Missed Call Text", type: "subscription", orderTable: "missed_call_clients" },
];

interface CheckResult {
  product: ProductCheck;
  status: "PASS" | "WARNING" | "FAIL";
  issues: string[];
  details: string[];
}

async function checkDeliveryFailures(productId: string, days = 7): Promise<{ count: number; samples: string[] }> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, count } = await supabase
    .from("delivery_failures")
    .select("error_message, created_at", { count: "exact" })
    .eq("product_type", productId)
    .gte("created_at", since)
    .limit(3);

  const samples = (data || []).map((r: any) => r.error_message?.slice(0, 120) || "unknown error");
  return { count: count ?? 0, samples };
}

async function checkStuckOrders(tableName: string): Promise<number> {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  try {
    const { count } = await supabase
      .from(tableName as any)
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("created_at", twoHoursAgo);
    return count ?? 0;
  } catch {
    return 0; // table might not have status column
  }
}

async function checkClientCount(tableName: string): Promise<number> {
  try {
    const { count } = await supabase
      .from(tableName as any)
      .select("id", { count: "exact", head: true })
      .eq("is_test", false);
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function runProductCheck(product: ProductCheck): Promise<CheckResult> {
  const issues: string[] = [];
  const details: string[] = [];
  let status: "PASS" | "WARNING" | "FAIL" = "PASS";

  // Check delivery failures in last 7 days
  const { count: failCount, samples } = await checkDeliveryFailures(product.id, 7);
  if (failCount > 0) {
    status = "FAIL";
    issues.push(`${failCount} delivery failure(s) in last 7 days`);
    samples.forEach(s => details.push(`Error: ${s}`));
  }

  // Check stuck orders (instant delivery only)
  if (product.type === "instant" && product.orderTable) {
    const stuck = await checkStuckOrders(product.orderTable);
    if (stuck > 0) {
      status = "FAIL";
      issues.push(`${stuck} stuck pending order(s) >2h old`);
    }
  }

  // Check client count for subscriptions
  if (product.type === "subscription" && product.orderTable) {
    const clientCount = await checkClientCount(product.orderTable);
    details.push(`Active clients: ${clientCount}`);
    if (clientCount === 0) {
      // Not a failure — just informational (no paying customers yet)
      details.push("No paying clients yet — delivery untested in production");
    }
  }

  if (issues.length === 0) {
    details.push("No delivery failures. No stuck orders.");
  }

  return { product, status, issues, details };
}

function buildEmailHtml(results: CheckResult[], runDate: string): string {
  const passing = results.filter(r => r.status === "PASS");
  const warnings = results.filter(r => r.status === "WARNING");
  const failing = results.filter(r => r.status === "FAIL");

  const total = results.length;
  const healthScore = Math.round((passing.length / total) * 100);
  const subjectSuffix = failing.length === 0 ? "All Systems Green ✅" : `${failing.length} Product(s) Need Attention ❌`;

  const failSection = failing.length > 0 ? `
    <div style="background:#1a0000;border:2px solid #ff4444;border-radius:8px;padding:16px;margin-bottom:16px;">
      <h3 style="color:#ff4444;margin:0 0 12px 0;">❌ FAILING — Action Required</h3>
      ${failing.map(r => `
        <div style="background:#2a0000;border-radius:6px;padding:12px;margin-bottom:8px;">
          <strong style="color:#ff6666;">${r.product.name}</strong>
          <ul style="color:#ffaaaa;margin:8px 0;padding-left:20px;">
            ${r.issues.map(i => `<li>${i}</li>`).join("")}
          </ul>
          ${r.details.length > 0 ? `<div style="color:#cc8888;font-size:12px;">${r.details.map(d => `<div>${d}</div>`).join("")}</div>` : ""}
        </div>
      `).join("")}
    </div>
  ` : "";

  const warnSection = warnings.length > 0 ? `
    <div style="background:#1a1400;border:1px solid #ffaa00;border-radius:8px;padding:16px;margin-bottom:16px;">
      <h3 style="color:#ffaa00;margin:0 0 12px 0;">⚠️ WARNINGS — Keep an Eye On</h3>
      ${warnings.map(r => `
        <div style="background:#222000;border-radius:6px;padding:10px;margin-bottom:6px;">
          <strong style="color:#ffcc44;">${r.product.name}</strong>
          <ul style="color:#ddbb88;margin:6px 0;padding-left:20px;font-size:13px;">
            ${r.issues.map(i => `<li>${i}</li>`).join("")}
          </ul>
        </div>
      `).join("")}
    </div>
  ` : "";

  const passSection = `
    <div style="background:#001a00;border:1px solid #44aa44;border-radius:8px;padding:16px;margin-bottom:16px;">
      <h3 style="color:#44aa44;margin:0 0 12px 0;">✅ PASSING — ${passing.length}/${total} Products Healthy</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
        ${passing.map(r => `
          <div style="background:#002200;border-radius:4px;padding:8px;">
            <span style="color:#88cc88;font-size:13px;">✓ ${r.product.name}</span>
            ${r.details.filter(d => d.startsWith("Active clients")).map(d => `<div style="color:#558855;font-size:11px;">${d}</div>`).join("")}
          </div>
        `).join("")}
      </div>
    </div>
  `;

  return `
    <div style="background:#0f172a;color:#e2e8f0;font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border-radius:12px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:32px;margin-bottom:8px;">🔵</div>
        <h1 style="color:#60a5fa;margin:0;font-size:22px;">Obi-Wan Integrity Report</h1>
        <p style="color:#94a3b8;margin:4px 0 0 0;font-size:13px;">${runDate} · Product Health Score: <strong style="color:${healthScore === 100 ? '#4ade80' : healthScore >= 75 ? '#facc15' : '#f87171'}">${healthScore}%</strong></p>
      </div>

      ${failSection}
      ${warnSection}
      ${passSection}

      <div style="background:#1e293b;border-radius:8px;padding:12px;margin-top:16px;text-align:center;">
        <p style="color:#64748b;font-size:12px;margin:0;">
          Obi-Wan runs every Sunday 6am ET · Checks delivery_failures, stuck orders, and client records<br/>
          Questions? Check Supabase Edge Function logs → obi-wan-integrity
        </p>
      </div>
    </div>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    console.log("[OBI-WAN] Starting weekly integrity check...");

    const results: CheckResult[] = [];
    for (const product of PRODUCTS) {
      console.log(`[OBI-WAN] Checking ${product.name}...`);
      const result = await runProductCheck(product);
      results.push(result);
      console.log(`[OBI-WAN] ${product.name}: ${result.status}${result.issues.length > 0 ? " — " + result.issues.join(", ") : ""}`);
    }

    const failCount = results.filter(r => r.status === "FAIL").length;
    const passCount = results.filter(r => r.status === "PASS").length;
    const runDate = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const subject = failCount > 0
      ? `⚠️ Obi-Wan: ${failCount} Product(s) Need Attention — ${runDate}`
      : `✅ Obi-Wan: All ${passCount} Products Healthy — ${runDate}`;

    const html = buildEmailHtml(results, runDate);

    // Send report to Matt
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Obi-Wan <matt@mattmichelstraining.com>",
        to: [MATT],
        subject,
        html,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error("[OBI-WAN] Email send failed:", err);
    } else {
      console.log("[OBI-WAN] Report emailed to Matt.");
    }

    return new Response(JSON.stringify({
      success: true,
      checked: results.length,
      passing: passCount,
      failing: failCount,
      results: results.map(r => ({ product: r.product.name, status: r.status, issues: r.issues })),
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[OBI-WAN]", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
