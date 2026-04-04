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

async function sendOpsEmail(subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Agent Ops <matt@mattmichelstraining.com>",
      to: ["matthewmichels4@gmail.com"],
      subject,
      html: `<div style="font-family:sans-serif;max-width:640px;margin:auto;padding:20px;background:#0c1222;color:#e2e8f0;border-radius:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <span style="font-size:20px;">⚙️</span>
          <strong style="color:#a78bfa;font-size:16px;">Agent Ops — Project Delivery</strong>
        </div>${html}</div>`,
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const issues: string[] = [];
    const now = new Date();

    // 1. Clients who paid but haven't submitted intake (5+ days)
    const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000).toISOString();
    const { data: noIntake } = await sb
      .from("web_design_leads")
      .select("id, business_name, email, created_at, status")
      .in("status", ["won", "approved", "intake_sent"])
      .lt("created_at", fiveDaysAgo)
      .limit(20);

    if (noIntake?.length) {
      issues.push(`<h3 style="color:#ef4444;">🚨 ${noIntake.length} CLIENTS — Paid but no intake (5+ days)</h3>
        <ul>${noIntake.map(l => `<li><strong>${l.business_name}</strong> (${l.email}) — paid ${new Date(l.created_at).toLocaleDateString()}</li>`).join("")}</ul>
        <p>💡 <em>Send a nudge: "Hey [Name], just checking in — did you get the intake form? Takes 5 min and then we start building!"</em></p>`);
    }

    // 2. Preview sent but no response in 7+ days
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const { data: ghostPreview } = await sb
      .from("web_design_leads")
      .select("id, business_name, email, updated_at, status")
      .eq("status", "preview_sent")
      .lt("updated_at", sevenDaysAgo)
      .limit(20);

    if (ghostPreview?.length) {
      issues.push(`<h3 style="color:#f59e0b;">👻 ${ghostPreview.length} GHOST CLIENTS — Preview sent, no response (7+ days)</h3>
        <ul>${ghostPreview.map(l => `<li><strong>${l.business_name}</strong> — preview sent ${new Date(l.updated_at).toLocaleDateString()}</li>`).join("")}</ul>
        <p>💡 <em>Send: "Hey [Name], just checking if you got a chance to look at your site preview! Happy to hop on a quick call if you want to walk through it."</em></p>`);
    }

    // 3. Active projects summary
    const { data: activeProjects } = await sb
      .from("web_design_leads")
      .select("status, business_name")
      .in("status", ["approved", "intake_sent", "intake_done", "building", "preview_sent", "revision"]);

    const statusCounts: Record<string, number> = {};
    activeProjects?.forEach(p => { statusCounts[p.status] = (statusCounts[p.status] || 0) + 1; });

    const projectHtml = `<h3>📋 Active Projects: ${activeProjects?.length || 0}</h3>
      <table style="width:100%;border-collapse:collapse;">
        ${Object.entries(statusCounts).map(([s, c]) => `<tr><td style="padding:4px 8px;border-bottom:1px solid #334155;">${s}</td><td style="text-align:right;padding:4px 8px;border-bottom:1px solid #334155;font-weight:bold;">${c}</td></tr>`).join("")}
      </table>`;

    // 4. Recently completed (last 7 days) — celebrate wins
    const { data: recentWins } = await sb
      .from("web_design_leads")
      .select("business_name, updated_at")
      .eq("status", "live")
      .gte("updated_at", sevenDaysAgo);

    const winsHtml = recentWins?.length
      ? `<h3 style="color:#22c55e;">🎉 ${recentWins.length} Sites Launched This Week!</h3><ul>${recentWins.map(w => `<li>${w.business_name}</li>`).join("")}</ul>`
      : "";

    if (issues.length > 0 || (activeProjects?.length || 0) > 0) {
      await sendOpsEmail(
        `⚙️ Ops: ${issues.length} issues, ${activeProjects?.length || 0} active projects`,
        issues.join("") + projectHtml + winsHtml
      );
    }

    return new Response(JSON.stringify({
      ok: true,
      stale_intake: noIntake?.length || 0,
      ghost_preview: ghostPreview?.length || 0,
      active_projects: activeProjects?.length || 0,
      recent_wins: recentWins?.length || 0,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[OPS]", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
