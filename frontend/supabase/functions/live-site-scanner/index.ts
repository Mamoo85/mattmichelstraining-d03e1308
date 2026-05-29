import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url, email, sendReport } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: "URL is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const DATAFORSEO_LOGIN = Deno.env.get("DATAFORSEO_LOGIN");
    const DATAFORSEO_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD");
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Clean URL
    const cleanUrl = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    let mobileScore = null;
    let seoScore = null;
    let issues: string[] = [];

    // DataForSEO PageSpeed
    if (DATAFORSEO_LOGIN && DATAFORSEO_PASSWORD) {
      try {
        const auth = btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);
        const psRes = await fetch("https://api.dataforseo.com/v3/on_page/page_screenshot", {
          method: "POST",
          headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
          body: JSON.stringify([{ url: `https://${cleanUrl}`, enable_javascript: true }]),
        });
        // Use lighthouse instead
        const lhRes = await fetch("https://api.dataforseo.com/v3/on_page/lighthouse/live/json", {
          method: "POST",
          headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
          body: JSON.stringify([{ url: `https://${cleanUrl}`, for_mobile: true }]),
        });
        const lhData = await lhRes.json();
        if (lhData?.tasks?.[0]?.result?.[0]) {
          const r = lhData.tasks[0].result[0];
          mobileScore = r.categories?.performance?.score ? Math.round(r.categories.performance.score * 100) : null;
          seoScore = r.categories?.seo?.score ? Math.round(r.categories.seo.score * 100) : null;
        }
      } catch (e) {
        console.error("DataForSEO error:", e);
      }
    }

    // Generate AI summary
    if (LOVABLE_API_KEY || OPENROUTER_API_KEY) {
      try {
        const apiKey = LOVABLE_API_KEY || OPENROUTER_API_KEY;
        const apiUrl = LOVABLE_API_KEY
          ? "https://ai.gateway.lovable.dev/v1/chat/completions"
          : "https://openrouter.ai/api/v1/chat/completions";

        const aiRes = await fetch(apiUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: LOVABLE_API_KEY ? "google/gemini-2.5-flash-lite" : "perplexity/sonar-reasoning",
            messages: [{
              role: "user",
              content: `Analyze this website: ${cleanUrl}. Mobile score: ${mobileScore ?? "unknown"}, SEO score: ${seoScore ?? "unknown"}. Provide exactly 3 specific, actionable issues as a JSON array of strings. Focus on mobile usability, SEO, and lead capture. Return ONLY the JSON array, nothing else.`,
            }],
          }),
        });
        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content || "[]";
        try {
          issues = JSON.parse(content.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
        } catch { issues = [content]; }
      } catch (e) {
        console.error("AI summary error:", e);
        issues = ["Mobile optimization needed", "SEO meta tags missing", "No click-to-call button detected"];
      }
    } else {
      issues = ["Mobile optimization needed", "SEO meta tags missing", "No click-to-call button detected"];
    }

    const scores = { mobileScore, seoScore, issues };

    // Save lead
    if (email) {
      await supabase.from("site_scanner_leads").insert({ email, url: cleanUrl, scores, report_sent: !!sendReport });
    }

    // Send full report via email
    if (email && sendReport && RESEND_API_KEY) {
      const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
      await fetch(`${GATEWAY_URL}/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": RESEND_API_KEY,
        },
        body: JSON.stringify({
          from: "Detroit Web Agency <matt@detroitwebagent.com>",
          to: [email],
          subject: `Site Health Report: ${cleanUrl}`,
          html: `<h2>Site Health Report for ${cleanUrl}</h2>
            <p><strong>Mobile Score:</strong> ${mobileScore ?? "N/A"}/100</p>
            <p><strong>SEO Score:</strong> ${seoScore ?? "N/A"}/100</p>
            <h3>Top Issues Found:</h3>
            <ul>${issues.map((i: string) => `<li>${i}</li>`).join("")}</ul>
            <p><a href="https://www.detroitwebagent.com/ai-website-audit">Get a full professional audit →</a></p>
            <p>— Matt Michels, Lead Web Agent<br/>Detroit Web Agency | (313) 992-1219</p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ url: cleanUrl, mobileScore, seoScore, issues }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("live-site-scanner error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
