import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

serve(async (_req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const tables = [
      { name: "reputation_clients", lastField: "last_report_at", freq: 7 },
      { name: "newsletter_service_clients", lastField: "last_sent_at", freq: 30 },
      { name: "blog_post_clients", lastField: "last_sent_at", freq: 30 },
      { name: "ads_copy_clients", lastField: "last_sent_at", freq: 30 },
      { name: "competitor_watch_clients", lastField: "last_report_at", freq: 7 },
      { name: "local_seo_clients", lastField: "last_generated_at", freq: 30 },
    ];

    let atRisk: any[] = [];
    for (const t of tables) {
      try {
        const { data } = await sb.from(t.name).select("*").eq("active", true);
        if (data) {
          for (const c of data) {
            const lastDate = c[t.lastField];
            if (!lastDate) continue;
            const daysSince = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
            // If over 2x the expected frequency, they're at risk
            if (daysSince > t.freq * 2) {
              atRisk.push({ email: c.email, business: c.business_name, service: t.name.replace("_clients", ""), daysSince });
            }
          }
        }
      } catch { /* skip */ }
    }

    let sent = 0;
    for (const client of atRisk) {
      try {
        const aiRes = await fetch("https://ai.lovable.dev/api/chat", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: `Write a very short, personal check-in email from Matt at M² Performance to ${client.business} about their ${client.service.replace(/_/g, " ")} service. It's been ${client.daysSince} days since their last delivery. Ask if everything's okay, offer to adjust the service, remind them of the value. Under 100 words. Warm and genuine.` }],
          }),
        });
        const aiData = await aiRes.json();
        const body = aiData?.choices?.[0]?.message?.content || "";

        if (RESEND_API_KEY && body) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Matt Michels <matt@mattmichelstraining.com>",
              to: [client.email],
              subject: `Checking in — ${client.business}`,
              html: `<div style="font-family:sans-serif;max-width:500px;padding:20px;">${body.replace(/\n/g, "<br>")}</div>`,
            }),
          });
          sent++;
        }
      } catch (e) { console.error(`[CHURN] Error for ${client.email}:`, e); }
    }

    // Notify Matt about at-risk accounts
    if (RESEND_API_KEY && atRisk.length > 0) {
      const list = atRisk.map(c => `• ${c.business} (${c.service}) — ${c.daysSince} days since delivery`).join("<br>");
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² Churn Alert <matt@mattmichelstraining.com>",
          to: ["matt@m2training.com"],
          subject: `⚠️ ${atRisk.length} clients at churn risk`,
          html: `<div style="font-family:sans-serif;padding:20px;background:#1e293b;color:#e2e8f0;border-radius:12px;"><h2 style="color:#eab308;">⚠️ Churn Risk Alert</h2><p>${list}</p><p style="color:#94a3b8;">Check-in emails have been sent automatically.</p></div>`,
        }),
      });
    }

    return new Response(JSON.stringify({ ok: true, atRisk: atRisk.length, sent }), { status: 200 });
  } catch (e: any) { console.error("[CHURN] Fatal:", e); return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
});
