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

async function sendHypeEmail(subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Agent Hype <matt@mattmichelstraining.com>",
      to: ["matthewmichels4@gmail.com"],
      subject,
      html: `<div style="font-family:sans-serif;max-width:640px;margin:auto;padding:20px;background:#1a2e05;color:#e2e8f0;border-radius:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <span style="font-size:20px;">🔥</span>
          <strong style="color:#84cc16;font-size:16px;">Agent Hype — Social Proof Engine</strong>
        </div>${html}</div>`,
    }),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // 1. Find clients who launched sites in the last 30 days — prime for review asks
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: recentLaunches } = await sb
      .from("web_design_leads")
      .select("business_name, email, updated_at")
      .eq("status", "live")
      .gte("updated_at", thirtyDaysAgo)
      .limit(20);

    // 2. Find B2B clients active 30+ days — happy clients for testimonials
    const { data: happyClients } = await sb
      .from("b2b_clients")
      .select("business_name, email, created_at")
      .lt("created_at", thirtyDaysAgo)
      .limit(20);

    // 3. Check review_monitor_clients for businesses getting good reviews
    const { data: reviewClients } = await sb
      .from("review_monitor_clients")
      .select("business_name, email, google_place_id")
      .eq("active", true)
      .not("google_place_id", "is", null)
      .limit(20);

    // 4. Check generated_sites for published success stories
    const { data: publishedSites } = await sb
      .from("generated_sites")
      .select("business_name, slug")
      .eq("is_published", true)
      .limit(20);

    let html = `<h3>📊 Social Proof Inventory</h3>
      <p>Published client sites (portfolio pieces): <strong>${publishedSites?.length || 0}</strong></p>
      <p>Active review monitor clients: <strong>${reviewClients?.length || 0}</strong></p>
      <p>Long-term B2B clients (testimonial candidates): <strong>${happyClients?.length || 0}</strong></p>`;

    // Suggest review asks for recent launches
    if (recentLaunches?.length) {
      html += `<h3 style="color:#84cc16;">⭐ Review Request Candidates (launched in last 30 days)</h3>
        <ul>${recentLaunches.map(l => `<li><strong>${l.business_name}</strong> (${l.email}) — launched ${new Date(l.updated_at).toLocaleDateString()}</li>`).join("")}</ul>
        <p>💡 <em>Send: "Hey [Name], your site's been live for a few weeks now — would you mind leaving us a quick Google review? It really helps!"</em></p>`;
    }

    // Suggest testimonial asks for long-term clients
    if (happyClients?.length && happyClients.length > 3) {
      html += `<h3 style="color:#22d3ee;">💬 Testimonial Candidates (30+ day clients)</h3>
        <p>${happyClients.length} clients have been with you 30+ days. Pick 3-5 to ask for a written testimonial or quick video.</p>`;
    }

    // NEW: 5. Auto-generate before/after case study drafts for newly live sites
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    let caseStudyHtml = "";
    if (lovableKey && recentLaunches?.length) {
      const newest = recentLaunches[0];
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: `Write a short 3-paragraph case study for M² Performance Training's web design service. Client: ${newest.business_name}. Format: Problem → Solution → Result. Keep it concise and professional. Use real-sounding metrics.` }],
          }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const caseStudy = aiData?.choices?.[0]?.message?.content || "";
          if (caseStudy.length > 50) {
            caseStudyHtml = `<h3 style="color:#84cc16;">📝 Auto-Draft Case Study: ${newest.business_name}</h3>
              <div style="background:#1a2e05;padding:12px;border-radius:8px;font-size:13px;">${caseStudy.replace(/\n/g, "<br/>")}</div>
              <p style="font-size:11px;color:#94a3b8;">Review and post to your website or social media</p>`;
          }
        }
      } catch (e) {
        console.log("[HYPE] Case study generation failed:", e);
      }
    }

    html += caseStudyHtml;

    const hasOpportunities = (recentLaunches?.length || 0) > 0 || (happyClients?.length || 0) > 3;
    if (hasOpportunities) {
      await sendHypeEmail(
        `🔥 Hype: ${recentLaunches?.length || 0} review asks ready, ${happyClients?.length || 0} testimonial candidates`,
        html
      );
    }

    return new Response(JSON.stringify({
      ok: true,
      review_candidates: recentLaunches?.length || 0,
      testimonial_candidates: happyClients?.length || 0,
      published_portfolio: publishedSites?.length || 0,
      case_study_drafted: caseStudyHtml.length > 0,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[HYPE]", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
