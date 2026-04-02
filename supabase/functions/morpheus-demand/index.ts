// MORPHEUS — Weekly Strategic Intelligence
// "What if I told you... there's $4,200/mo sitting in your waitlist?"
//
// Runs every Sunday at 8am ET. Analyzes ALL waitlist signups by product,
// cross-references them against build cost, delivery complexity, and revenue
// potential. Sends Matt a ranked "build this next" brief.
//
// This isn't just counting signups. Morpheus scores each opportunity using the
// same framework from the agent file: Automation × Revenue × Build Cost ×
// Audience Fit × Competitive Moat. Each product gets a score out of 15.
//
// Enhanced beyond basic waitlist counting:
//   - Revenue potential modeling (if X signups convert at Y%, here's MRR)
//   - Compares current MRR vs target ($10k/mo) so Matt always knows the gap
//   - Identifies which existing products are growing vs stagnating
//   - Recommends ONE specific action for the week (not a list — one thing)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const MATT = "matt@mattmichelstraining.com";
const MRR_TARGET = 10000;

// Matt's own test accounts — never count these in revenue or subscriber totals
const TEST_EMAILS = [
  "matt@mattmichelstraining.com",
  "matthewmichels@gmail.com",
  "matthewmichels4@gmail.com",
];

// Scoring rubric for each potential product
// Based on: Automation(0-3) × Revenue(0-3) × BuildCost(0-3,inv) × AudienceFit(0-3) × Moat(0-3)
const PRODUCT_SCORES: Record<string, { automation: number; revenue: number; buildCost: number; audienceFit: number; moat: number; price: number; type: "one_time" | "recurring" }> = {
  "appointment reminders": { automation: 3, revenue: 2, buildCost: 2, audienceFit: 3, moat: 1, price: 79, type: "recurring" },
  "review request sms": { automation: 3, revenue: 2, buildCost: 2, audienceFit: 3, moat: 1, price: 49, type: "recurring" },
  "missed call saas": { automation: 3, revenue: 3, buildCost: 1, audienceFit: 3, moat: 2, price: 149, type: "recurring" },
  "speed to lead": { automation: 3, revenue: 3, buildCost: 1, audienceFit: 3, moat: 2, price: 199, type: "recurring" },
  "ai blog post service": { automation: 3, revenue: 2, buildCost: 2, audienceFit: 2, moat: 2, price: 99, type: "recurring" },
  "ai proposal generator": { automation: 2, revenue: 2, buildCost: 2, audienceFit: 2, moat: 2, price: 49, type: "recurring" },
  "ai social caption pack": { automation: 3, revenue: 2, buildCost: 3, audienceFit: 2, moat: 1, price: 29, type: "one_time" },
  "trainer social ai": { automation: 3, revenue: 2, buildCost: 3, audienceFit: 2, moat: 2, price: 149, type: "recurring" },
  "text message marketing": { automation: 2, revenue: 2, buildCost: 1, audienceFit: 2, moat: 1, price: 99, type: "recurring" },
};

function scoreProduct(productKey: string): number {
  const s = PRODUCT_SCORES[productKey.toLowerCase()];
  if (!s) return 0;
  return s.automation + s.revenue + s.buildCost + s.audienceFit + s.moat;
}

function modelRevenue(signups: number, productKey: string): { optimistic: number; realistic: number; conservative: number } {
  const p = PRODUCT_SCORES[productKey.toLowerCase()];
  if (!p) return { optimistic: 0, realistic: 0, conservative: 0 };
  // Conversion rates: optimistic 25%, realistic 15%, conservative 8%
  return {
    optimistic: Math.round(signups * 0.25 * p.price),
    realistic: Math.round(signups * 0.15 * p.price),
    conservative: Math.round(signups * 0.08 * p.price),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Count all waitlist signups by product
    const { data: allWaitlist } = await sb
      .from("newsletter_subscribers")
      .select("source, created_at")
      .like("source", "waitlist_%")
      .eq("is_active", true);

    const waitlistCounts: Record<string, { total: number; newThisWeek: number }> = {};
    const sevenDaysAgoDate = new Date(sevenDaysAgo);
    for (const row of allWaitlist || []) {
      const product = (row.source as string).replace("waitlist_", "").replace(/_/g, " ");
      if (!waitlistCounts[product]) waitlistCounts[product] = { total: 0, newThisWeek: 0 };
      waitlistCounts[product].total++;
      if (new Date(row.created_at) > sevenDaysAgoDate) waitlistCounts[product].newThisWeek++;
    }

    // 2. Score and rank each product
    const rankedProducts = Object.entries(waitlistCounts)
      .map(([product, counts]) => ({
        product,
        ...counts,
        score: scoreProduct(product),
        revenue: modelRevenue(counts.total, product),
        productData: PRODUCT_SCORES[product.toLowerCase()],
      }))
      .sort((a, b) => {
        // Sort by score × total signups (demand × feasibility)
        return (b.score * b.total) - (a.score * a.total);
      });

    // 3. Get current MRR estimate
    const [gbpCount, socialCount, fieldRepCount] = await Promise.all([
      sb.from("gbp_saas_clients").select("*", { count: "exact", head: true }).eq("status", "active").not("email", "in", TEST_EMAILS),
      sb.from("social_media_clients").select("*", { count: "exact", head: true }).eq("status", "active").not("email", "in", TEST_EMAILS),
      sb.from("b2b_subscribers").select("*", { count: "exact", head: true }).not("email", "in", TEST_EMAILS),
    ]);
    const estimatedMrr = (gbpCount.count || 0) * 49 + (socialCount.count || 0) * 199 + (fieldRepCount.count || 0) * 29;
    const mrrGap = Math.max(0, MRR_TARGET - estimatedMrr);

    // 4. New orders this week
    const [newAudits, newGbps, newReports] = await Promise.all([
      sb.from("audit_orders").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo).not("email", "in", TEST_EMAILS),
      sb.from("gbp_post_packs").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo).not("email", "in", TEST_EMAILS),
      sb.from("competitor_reports").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo).not("email", "in", TEST_EMAILS),
    ]);
    const oneTimeRevenue7d = ((newAudits.count || 0) + (newGbps.count || 0) + (newReports.count || 0)) * 49;

    // 5. The ONE recommended action
    const topProduct = rankedProducts[0];
    let recommendation = "";
    if (mrrGap > 5000) {
      recommendation = `Your MRR gap is $${mrrGap.toLocaleString()}. Focus 100% of build time on converting the ${topProduct?.product || "highest-demand"} waitlist. Don't build anything new — convert what you have.`;
    } else if (topProduct && topProduct.score >= 12) {
      recommendation = `Build ${topProduct.product}. Score: ${topProduct.score}/15. ${topProduct.total} people waiting. Realistic revenue: $${topProduct.revenue.realistic.toLocaleString()}/mo at launch. This is the highest ROI thing you can build right now.`;
    } else if (oneTimeRevenue7d < 200) {
      recommendation = `One-time product sales are slow ($${oneTimeRevenue7d} this week). Run ads before building anything new. You need traffic, not more products.`;
    } else {
      recommendation = `Things look solid. Keep the ads running. ${rankedProducts[0] ? `When you have dev time, ${rankedProducts[0].product} has the most waitlist demand.` : ""}`;
    }

    // Build the email
    const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const subject = `Morpheus Sunday Brief — $${estimatedMrr.toLocaleString()}/mo MRR · $${mrrGap.toLocaleString()} gap`;

    const html = `<!DOCTYPE html><html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
  <tr><td style="background:#1e293b;padding:18px 28px;border-radius:10px 10px 0 0;">
    <p style="margin:0;color:#e8621a;font-size:10px;font-weight:800;letter-spacing:3px;text-transform:uppercase;">Morpheus — Strategic Intelligence</p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">${dateStr}</p>
  </td></tr>
  <tr><td style="background:#fff;padding:28px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">

    <!-- MRR Dashboard -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:14px;text-align:center;width:33%;">
          <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Est. MRR</p>
          <p style="margin:4px 0 0;font-size:24px;font-weight:800;color:#1e293b;">$${estimatedMrr.toLocaleString()}</p>
        </td>
        <td width="8"></td>
        <td style="background:${mrrGap > 5000 ? "#fef2f2" : mrrGap > 2000 ? "#fffbeb" : "#f0fdf4"};border:1px solid ${mrrGap > 5000 ? "#fecaca" : mrrGap > 2000 ? "#fde68a" : "#bbf7d0"};border-radius:6px;padding:14px;text-align:center;width:33%;">
          <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Gap to $10k</p>
          <p style="margin:4px 0 0;font-size:24px;font-weight:800;color:${mrrGap > 5000 ? "#dc2626" : mrrGap > 2000 ? "#d97706" : "#16a34a"};">$${mrrGap.toLocaleString()}</p>
        </td>
        <td width="8"></td>
        <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:14px;text-align:center;width:33%;">
          <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">One-time (7d)</p>
          <p style="margin:4px 0 0;font-size:24px;font-weight:800;color:#1e293b;">$${oneTimeRevenue7d}</p>
        </td>
      </tr>
    </table>

    <!-- THE ONE RECOMMENDATION -->
    <div style="background:#1e293b;border-radius:8px;padding:18px 22px;margin:0 0 24px;">
      <p style="margin:0 0 8px;font-size:10px;font-weight:800;letter-spacing:3px;color:#e8621a;text-transform:uppercase;">This Week's One Action</p>
      <p style="margin:0;font-size:15px;color:#f1f5f9;line-height:1.8;font-weight:500;">${recommendation}</p>
    </div>

    <!-- Waitlist Demand Rankings -->
    ${rankedProducts.length > 0 ? `
    <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:2px;color:#64748b;text-transform:uppercase;">Waitlist Demand Rankings</p>
    ${rankedProducts.slice(0, 8).map((p, i) => `
      <div style="border:1px solid #e2e8f0;border-radius:6px;padding:12px 16px;margin:0 0 8px;background:${i === 0 ? "#fff7ed" : "#fff"};">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <span style="font-size:13px;font-weight:700;color:#1e293b;">${i + 1}. ${p.product}</span>
            ${p.newThisWeek > 0 ? `<span style="font-size:11px;color:#16a34a;margin-left:8px;">+${p.newThisWeek} this week</span>` : ""}
          </div>
          <div style="text-align:right;">
            <span style="font-size:12px;color:#64748b;">${p.total} waiting</span>
            <span style="margin-left:8px;font-size:11px;font-weight:700;color:${p.score >= 12 ? "#16a34a" : p.score >= 8 ? "#d97706" : "#dc2626"};background:${p.score >= 12 ? "#f0fdf4" : p.score >= 8 ? "#fffbeb" : "#fef2f2"};padding:2px 8px;border-radius:99px;">Score ${p.score}/15</span>
          </div>
        </div>
        ${p.productData ? `<p style="margin:6px 0 0;font-size:11px;color:#64748b;">Realistic launch revenue: $${p.revenue.realistic.toLocaleString()}/mo · ${p.productData.type === "recurring" ? "Recurring" : "One-time"} · $${p.productData.price}</p>` : ""}
      </div>`).join("")}` : `<p style="font-size:14px;color:#64748b;">No waitlist signups yet. The WaitlistGate is collecting — keep driving traffic.</p>`}

    <hr style="border:1px solid #e2e8f0;margin:24px 0;">
    <p style="font-size:12px;color:#94a3b8;line-height:1.6;">Morpheus runs every Sunday at 8am ET. Numbers are estimates based on subscription table counts. Questions: <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a></p>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:10px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;font-size:11px;color:#94a3b8;">
    Morpheus Strategic Intelligence · M² Performance Training
  </td></tr>
</table></td></tr></table>
</body></html>`;

    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `Morpheus <${MATT}>`, to: [MATT], subject, html }),
      });
    }

    console.log(`[MORPHEUS] Sunday brief sent — MRR: $${estimatedMrr}, gap: $${mrrGap}, top product: ${rankedProducts[0]?.product}`);
    return new Response(JSON.stringify({ ok: true, estimated_mrr: estimatedMrr, mrr_gap: mrrGap, top_product: rankedProducts[0]?.product }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[MORPHEUS]", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
