import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

serve(async (_req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const { data: clients } = await sb.from("kpi_email_clients").select("*").eq("active", true);
    if (!clients?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
    let sent = 0;
    for (const client of clients) {
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite", 
            messages: [{ role: "user", content: `Generate a weekly KPI dashboard email for "${client.business_name}" (${client.industry || "local business"}). Include:\n\n1. **Industry Benchmarks** — typical weekly metrics for a ${client.industry || "small"} business (revenue range, customer count, avg ticket)\n2. **Review Score Check** — remind them to check Google reviews this week\n3. **Website Performance** — generic tips to improve site speed and conversions\n4. **3 AI-Recommended Actions** — specific, actionable things to do this week based on their industry\n\nFormat as clean HTML with colored stat boxes. Use placeholder numbers they should replace with real data.` }] }) });
        const aiData = await aiRes.json();
        const content = aiData?.choices?.[0]?.message?.content || "<p>KPI report unavailable this week.</p>";
        if (RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "M² KPI Dashboard <matt@mattmichelstraining.com>", to: [client.email], bcc: ["matthewmichels4@gmail.com"],
              subject: `Weekly KPI Report — ${client.business_name}`,
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">${content}<hr style="margin:20px 0;border:none;border-top:1px solid #e2e8f0;"><p style="color:#94a3b8;font-size:12px;">Replace placeholder numbers with your real data to track trends over time. — Matt</p><div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;">
        <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
        <div style="font-size:13px;color:#94a3b8;">
          <strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952
        </div>
        <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M² Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
      </div></div>` }) });
        }
        await sb.from("kpi_email_clients").update({ report_count: (client.report_count || 0) + 1, last_sent_at: new Date().toISOString() }).eq("id", client.id);
        sent++;
      } catch (e) { console.error(`[KPI-EMAIL] Error for ${client.email}:`, e); }
    }
    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); console.error("[KPI-EMAIL] Fatal:", e); return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
});
