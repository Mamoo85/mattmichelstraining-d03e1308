import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { companyName, clientEmail } = await req.json();
    if (!companyName) {
      return new Response(JSON.stringify({ error: "companyName required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Research the company via Firecrawl
    let companyData = "";
    if (FIRECRAWL_API_KEY) {
      const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: `${companyName} company about`, limit: 3, scrapeOptions: { formats: ["markdown"] } }),
      });
      const searchData = await searchRes.json();
      if (searchData?.data?.length) {
        companyData = searchData.data.map((r: any) => `Source: ${r.url}\n${r.markdown?.slice(0, 800) || r.description || ""}`).join("\n\n---\n\n");
      }
    }

    // Generate briefing
    const aiRes = await fetch("https://ai.lovable.dev/api/chat", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: `Create a 1-page meeting prep briefing for a sales meeting with "${companyName}".\n\nResearch data:\n${companyData || "No web data available — use your knowledge."}\n\nInclude:\n1. Company Overview (what they do, size estimate, location)\n2. Key Decision Makers (if found)\n3. Recent News or Changes\n4. Potential Pain Points\n5. Recommended Talking Points\n6. 3 Discovery Questions to Ask\n\nFormat as clean, scannable HTML with h3 headings. Keep it concise and actionable.` }],
      }),
    });
    const aiData = await aiRes.json();
    const briefing = aiData?.choices?.[0]?.message?.content || "<p>Briefing unavailable.</p>";

    // If client email provided, email the briefing
    if (RESEND_API_KEY && clientEmail) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² Meeting Prep <matt@mattmichelstraining.com>",
          to: [clientEmail],
          subject: `Meeting Prep: ${companyName}`,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#ffffff;color:#1e293b;border-radius:12px;">${briefing}</div>`,
        }),
      });
    }

    // Track usage
    if (clientEmail) {
      await sb.from("meeting_prep_clients").update({ prep_count: 1 }).eq("email", clientEmail);
    }

    return new Response(JSON.stringify({ ok: true, briefing }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[MEETING-PREP] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
