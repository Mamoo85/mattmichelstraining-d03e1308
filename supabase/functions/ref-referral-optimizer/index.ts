import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendRefEmail(subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Agent Ref <matt@mattmichelstraining.com>",
      to: ["matthewmichels4@gmail.com"],
      subject,
      html: `<div style="font-family:sans-serif;max-width:640px;margin:auto;padding:20px;background:#2d1b0e;color:#e2e8f0;border-radius:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <span style="font-size:20px;">🤝</span>
          <strong style="color:#f59e0b;font-size:16px;">Agent Ref — Referral Optimizer</strong>
        </div>${html}</div>`,
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // 1. B2B Referral Partners — activity check
    const { data: partners } = await sb
      .from("b2b_referral_partners")
      .select("id, name, email, referral_code, total_earned, status, created_at")
      .eq("status", "active")
      .limit(50);

    // 2. Recent conversions (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: conversions } = await sb
      .from("b2b_referral_conversions")
      .select("partner_id, commission_amount, status, created_at")
      .gte("created_at", thirtyDaysAgo);

    // 3. Calculate partner ROI
    const partnerStats: Record<string, { conversions: number; revenue: number }> = {};
    conversions?.forEach(c => {
      if (!partnerStats[c.partner_id]) partnerStats[c.partner_id] = { conversions: 0, revenue: 0 };
      partnerStats[c.partner_id].conversions++;
      partnerStats[c.partner_id].revenue += c.commission_amount;
    });

    // 4. Inactive partners (signed up but no conversions ever)
    const inactivePartners = partners?.filter(p => !partnerStats[p.id]) || [];

    // 5. Training app referral codes
    const { count: appReferralCodes } = await sb
      .from("referral_codes")
      .select("id", { count: "exact", head: true });

    // 6. Referral program clients (B2B SMS referral product)
    const { data: refProgramClients } = await sb
      .from("referral_program_clients")
      .select("business_name, active, last_sent_at")
      .eq("active", true)
      .limit(20);

    let html = `<h3>📊 Referral Network Health</h3>
      <p>Active B2B partners: <strong>${partners?.length || 0}</strong></p>
      <p>Conversions (30 days): <strong>${conversions?.length || 0}</strong></p>
      <p>Commission paid (30 days): <strong>$${conversions?.reduce((s, c) => s + c.commission_amount, 0)?.toFixed(2) || "0.00"}</strong></p>
      <p>App referral codes issued: <strong>${appReferralCodes || 0}</strong></p>
      <p>Active referral SMS clients: <strong>${refProgramClients?.length || 0}</strong></p>`;

    // Top performers
    const topPartners = Object.entries(partnerStats)
      .sort((a, b) => b[1].conversions - a[1].conversions)
      .slice(0, 5);

    if (topPartners.length) {
      html += `<h3 style="color:#22c55e;">🏆 Top Partners (30 days)</h3>
        <ul>${topPartners.map(([id, stats]) => {
          const partner = partners?.find(p => p.id === id);
          return `<li><strong>${partner?.name || id}</strong>: ${stats.conversions} conversions, $${stats.revenue.toFixed(2)} earned</li>`;
        }).join("")}</ul>`;
    }

    if (inactivePartners.length) {
      html += `<h3 style="color:#f59e0b;">💤 ${inactivePartners.length} Inactive Partners (0 conversions)</h3>
        <ul>${inactivePartners.slice(0, 5).map(p => `<li>${p.name} (${p.email}) — joined ${new Date(p.created_at).toLocaleDateString()}</li>`).join("")}</ul>
        <p>💡 <em>Send a nudge with fresh marketing materials or increased commission offer</em></p>`;
    }

    // NEW: 7. Identify top-performing referrers and draft thank-you emails
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    let thankYouHtml = "";
    if (lovableKey && topPartners.length > 0) {
      const topPartner = partners?.find(p => p.id === topPartners[0][0]);
      if (topPartner && topPartners[0][1].conversions >= 2) {
        try {
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [{ role: "user", content: `Write a short, warm thank-you email from Matt at M² to ${topPartner.name} who has referred ${topPartners[0][1].conversions} clients and earned $${topPartners[0][1].revenue.toFixed(2)}. Mention a bonus offer of 10% extra commission for the next 30 days. Keep it under 100 words, casual and appreciative.` }],
            }),
          });
          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const draft = aiData?.choices?.[0]?.message?.content || "";
            if (draft.length > 20) {
              thankYouHtml = `<h3 style="color:#f59e0b;">✉️ Draft Thank-You for ${topPartner.name}</h3>
                <div style="background:#2d1b0e;padding:12px;border-radius:8px;font-size:13px;">${draft.replace(/\n/g, "<br/>")}</div>
                <p style="font-size:11px;color:#94a3b8;">Review and send manually to ${topPartner.email}</p>`;
            }
          }
        } catch (e) {
          console.log("[REF] Thank-you draft failed:", e);
        }
      }
    }

    html += thankYouHtml;

    const hasAlerts = inactivePartners.length > 0 || (conversions?.length || 0) > 0;
    if (hasAlerts) {
      await sendRefEmail(
        `🤝 Ref: ${conversions?.length || 0} conversions, ${inactivePartners.length} inactive partners`,
        html
      );
    }

    return new Response(JSON.stringify({
      ok: true,
      active_partners: partners?.length || 0,
      conversions_30d: conversions?.length || 0,
      inactive_partners: inactivePartners.length,
      app_referral_codes: appReferralCodes || 0,
      thank_you_drafted: thankYouHtml.length > 0,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[REF]", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
