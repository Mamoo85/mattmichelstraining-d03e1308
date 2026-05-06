// Monthly Proof Email — 1st of month, sends performance report to all active clients
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function statCard(label: string, value: string | number, emoji: string, color: string): string {
  return `<td style="padding:8px">
    <div style="background:#0d1f3c;border:1px solid ${color}33;border-radius:10px;padding:20px;text-align:center">
      <p style="font-size:28px;margin:0">${emoji}</p>
      <p style="color:${color};font-size:28px;font-weight:900;margin:8px 0 4px">${value}</p>
      <p style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0">${label}</p>
    </div>
  </td>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const monthName = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

    // Gather all active clients across products
    const clientMap = new Map<string, { email: string; business_name: string; products: string[] }>();

    const tables = [
      { table: "contractor_clients", product: "Contractor Leads" },
      { table: "hire_alert_clients", product: "TechAlert" },
      { table: "field_crm_clients", product: "FieldDesk" },
      { table: "missed_call_clients", product: "Missed Call Catch" },
    ];

    for (const t of tables) {
      const { data } = await sb.from(t.table)
        .select("email, business_name")
        .eq("active", true);

      for (const c of (data || [])) {
        if (!c.email || c.email === "matt@mattmichelstraining.com" || c.email === "matt@detroitwebagent.com") continue;
        const existing = clientMap.get(c.email);
        if (existing) {
          existing.products.push(t.product);
        } else {
          clientMap.set(c.email, { email: c.email, business_name: c.business_name || "Your Business", products: [t.product] });
        }
      }
    }

    let emailsSent = 0;

    for (const [email, client] of clientMap) {
      // Get stats for this client's email in system_comms_log
      const { count: totalComms } = await sb
        .from("system_comms_log")
        .select("id", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("created_at", thirtyDaysAgo);

      // Get leads delivered
      const { count: leadsCount } = await sb
        .from("contractor_lead_purchases")
        .select("id", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo);

      // Compose email
      const productsLabel = client.products.join(" · ");
      const leads = leadsCount || 0;
      const comms = totalComms || 0;

      const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#0a1628">
  <div style="padding:24px 32px 18px;border-bottom:2px solid #00d4ff;text-align:center">
    <div style="color:#fff;font-size:18px;font-weight:900;letter-spacing:2px">DETROIT <span style="color:#00d4ff">WEB AGENCY</span></div>
    <div style="color:#00d4ff;font-size:10px;letter-spacing:4px;margin-top:4px;font-weight:600">MONTHLY PERFORMANCE REPORT</div>
  </div>
  <div style="background:linear-gradient(135deg,#00d4ff22,#0a162800);padding:24px 32px;text-align:center">
    <p style="color:#fff;font-size:22px;font-weight:900;margin:0">${client.business_name}</p>
    <p style="color:#64748b;font-size:13px;margin:6px 0 0">Report for ${monthName}</p>
    <p style="color:#00d4ff;font-size:11px;margin:4px 0 0">${productsLabel}</p>
  </div>
  <div style="padding:24px 16px">
    <table style="width:100%;border-collapse:collapse">
      <tr>
        ${statCard("Leads Delivered", leads, "🎯", "#00d4ff")}
        ${statCard("Messages Sent", comms, "📨", "#10b981")}
      </tr>
      <tr>
        ${statCard("Active Products", client.products.length, "⚡", "#f59e0b")}
        ${statCard("Est. Revenue", "$" + (leads * 500).toLocaleString(), "💰", "#22c55e")}
      </tr>
    </table>
  </div>
  <div style="padding:0 32px 24px;text-align:center">
    <div style="background:#22c55e15;border:1px solid #22c55e33;border-radius:12px;padding:20px">
      <p style="color:#22c55e;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin:0 0 8px">TOTAL ESTIMATED REVENUE RECOVERED</p>
      <p style="color:#22c55e;font-size:36px;font-weight:900;margin:0">$${(leads * 500).toLocaleString()}</p>
    </div>
  </div>
  <div style="padding:20px 32px;border-top:1px solid #1e3a5f;text-align:center">
    <p style="color:#4a6fa5;font-size:12px;margin:0">Detroit Web Agency · (313) 992-1219</p>
    <p style="color:#64748b;font-size:11px;margin:6px 0 0">Reply to this email with questions or to adjust your services.</p>
  </div>
</div></body></html>`;

      if (RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Detroit Web Agency <matt@detroitwebagent.com>",
            to: [email],
            bcc: ["matt@detroitwebagent.com"],
            subject: `📊 Your DWA Performance Report — ${monthName}`,
            html,
          }),
        });
        emailsSent++;
      }
    }

    console.log(`[monthly-proof] Sent ${emailsSent} proof emails`);
    return new Response(JSON.stringify({ emails_sent: emailsSent }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[monthly-proof]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
