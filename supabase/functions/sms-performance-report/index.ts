import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

serve(async (_req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    // Query all active B2B client tables to build a health overview
    const tables = [
      { name: "reputation_clients", service: "Reputation Dashboard", freq: "weekly" },
      { name: "newsletter_service_clients", service: "Newsletter Service", freq: "monthly" },
      { name: "faq_refresh_clients", service: "FAQ Refresh", freq: "monthly" },
      { name: "blog_post_clients", service: "Blog Posts", freq: "monthly" },
      { name: "ads_copy_clients", service: "Ads Copy", freq: "monthly" },
      { name: "competitor_watch_clients", service: "Competitor Watch", freq: "weekly" },
      { name: "local_seo_clients", service: "Local SEO", freq: "monthly" },
      { name: "payment_chaser_clients", service: "Payment Chaser", freq: "on-demand" },
    ];

    const healthData: any[] = [];
    for (const t of tables) {
      try {
        const { data } = await sb.from(t.name).select("*").eq("active", true);
        if (data) {
          for (const client of data) {
            const lastDelivery = client.last_report_at || client.last_sent_at || client.last_refreshed_at || client.last_generated_at || client.last_audit_at;
            const daysSince = lastDelivery ? Math.floor((Date.now() - new Date(lastDelivery).getTime()) / 86400000) : 999;
            const maxDays = t.freq === "weekly" ? 10 : t.freq === "monthly" ? 35 : 999;
            healthData.push({
              business: client.business_name,
              email: client.email,
              service: t.service,
              lastDelivery: lastDelivery || "never",
              daysSince,
              status: daysSince > maxDays ? "overdue" : daysSince > maxDays * 0.8 ? "due_soon" : "healthy",
            });
          }
        }
      } catch { /* table might not exist yet */ }
    }

    // AI summary
    let summary = "No active clients found.";
    if (healthData.length > 0) {
      const overdue = healthData.filter(h => h.status === "overdue").length;
      const dueSoon = healthData.filter(h => h.status === "due_soon").length;
      const healthy = healthData.filter(h => h.status === "healthy").length;
      summary = `Total active: ${healthData.length} | Healthy: ${healthy} | Due soon: ${dueSoon} | Overdue: ${overdue}`;
    }

    // Email Matt a weekly health digest
    if (RESEND_API_KEY && healthData.length > 0) {
      const rows = healthData.map(h => 
        `<tr style="border-bottom:1px solid #334155;"><td style="padding:8px;">${h.business}</td><td style="padding:8px;">${h.service}</td><td style="padding:8px;">${h.lastDelivery === "never" ? "Never" : new Date(h.lastDelivery).toLocaleDateString()}</td><td style="padding:8px;color:${h.status === "overdue" ? "#ef4444" : h.status === "due_soon" ? "#eab308" : "#22c55e"};">${h.status.toUpperCase()}</td></tr>`
      ).join("");

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² Client Health <matt@mattmichelstraining.com>",
          to: ["matt@m2training.com"], bcc: ["matthewmichels4@gmail.com"],
          subject: `Client Health Report — ${summary}`,
          html: `<div style="font-family:sans-serif;max-width:700px;margin:0 auto;padding:20px;background:#1e293b;color:#e2e8f0;border-radius:12px;"><h2 style="color:#e8621a;">📊 Client Health Dashboard</h2><p>${summary}</p><table style="width:100%;border-collapse:collapse;margin-top:16px;"><thead><tr style="border-bottom:2px solid #e8621a;"><th style="padding:8px;text-align:left;">Business</th><th style="padding:8px;text-align:left;">Service</th><th style="padding:8px;text-align:left;">Last Delivery</th><th style="padding:8px;text-align:left;">Status</th></tr></thead><tbody>${rows}</tbody></table><div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;">
        <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
        <div style="font-size:13px;color:#94a3b8;">
          <strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952
        </div>
        <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M² Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
      </div></div>`,
        }),
      });
    }

    return new Response(JSON.stringify({ ok: true, summary, clients: healthData }), { status: 200 });
  } catch (e: any) { console.error("[SMS-PERF] Fatal:", e); return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
});
