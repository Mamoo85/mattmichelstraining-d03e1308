// dwa-abandoned-cart
// Runs hourly via cron. Finds DWA product checkouts abandoned 1+ hour ago
// with no recovery email sent, then emails a 10%-off discount code.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dwaEmail } from "../_shared/dwa-email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PRODUCT_LABELS: Record<string, string> = {
  hire_alert_subscription: "TechAlert — Hiring Signal Monitor",
  trade_radar_subscription: "Trade Radar — Contractor Lead System",
  mortgage_radar_subscription: "Mortgage Radar — LO Lead Intel",
  field_service_subscription: "FieldDesk — Field Service CRM",
  field_crm_subscription: "FieldDesk — Field Service CRM",
  missed_call_subscription: "Missed-Call Catch — Auto-Text Back",
  site_radar_subscription: "SiteRadar — Website Visitor ID",
  contractor_lead_subscription: "Contractor Lead Generation",
  dead_lead_billing_setup: "Dead Lead Reactivation",
};

const PRODUCT_URLS: Record<string, string> = {
  hire_alert_subscription: "https://detroitwebagency.com/tech-alert",
  trade_radar_subscription: "https://detroitwebagency.com/trade-radar",
  mortgage_radar_subscription: "https://detroitwebagency.com/mortgage-radar",
  field_service_subscription: "https://detroitwebagency.com/field-desk",
  field_crm_subscription: "https://detroitwebagency.com/field-desk",
  missed_call_subscription: "https://detroitwebagency.com/missed-call",
  site_radar_subscription: "https://detroitwebagency.com/site-radar",
  contractor_lead_subscription: "https://detroitwebagency.com/contractor-leads",
  dead_lead_billing_setup: "https://detroitwebagency.com/dead-lead-reactivation",
};

function generateDiscountCode(email: string, productType: string): string {
  const hash = Array.from(`${email}${productType}`)
    .reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  return `DWA10-${Math.abs(hash).toString(36).toUpperCase().slice(0, 6)}`;
}

Deno.serve(async () => {
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: abandonments } = await sb
    .from("cart_abandonments")
    .select("id, email, product_type, cart_value, created_at")
    .eq("brand", "dwa")
    .is("recovery_sent_at", null)
    .lt("created_at", oneHourAgo)
    .gt("created_at", twentyFourHoursAgo)
    .limit(20);

  if (!abandonments?.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
  }

  let sent = 0;
  for (const row of abandonments) {
    const label = PRODUCT_LABELS[row.product_type] || "Detroit Web Agency Product";
    const url = PRODUCT_URLS[row.product_type] || "https://detroitwebagency.com";
    const discountCode = generateDiscountCode(row.email, row.product_type);
    const monthlyPrice = row.cart_value || 0;

    const html = `
<div style="font-family:sans-serif;max-width:540px;background:#0a1628;color:#e2e8f0;padding:32px;border-radius:12px">
  <h2 style="color:#00d4ff;margin:0 0 16px">Did something come up?</h2>
  <p>You started signing up for <strong style="color:#fff">${label}</strong> but didn't finish. That's totally fine — I wanted to make sure it wasn't a question or hesitation I could help with.</p>
  <p>To make it easy to get started, use code <strong style="color:#34d399;font-size:18px">${discountCode}</strong> for <strong>10% off your first month</strong>${monthlyPrice ? ` (saves $${(monthlyPrice * 0.10).toFixed(0)})` : ""}.</p>
  <div style="text-align:center;margin:24px 0">
    <a href="${url}" style="background:#00d4ff;color:#0a1628;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px">
      Claim Your Discount →
    </a>
  </div>
  <p style="color:#94a3b8;font-size:14px">This code expires in 48 hours. If you have questions, just reply to this email — I read every one.</p>
  <p style="color:#64748b;font-size:13px;margin-top:24px">— Matt Michels · Detroit Web Agency<br>(313) 992-1219</p>
</div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Matt @ Detroit Web Agency <matt@detroitwebagency.com>",
        to: [row.email],
        subject: `You left ${label} behind — here's 10% off`,
        html,
      }),
    }).catch(() => null);

    if (res?.ok) {
      await sb.from("cart_abandonments")
        .update({ recovery_sent_at: new Date().toISOString(), discount_code: discountCode })
        .eq("id", row.id);
      sent++;
    }
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
