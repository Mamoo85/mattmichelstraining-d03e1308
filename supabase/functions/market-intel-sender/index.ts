import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: clients } = await supabase.from("market_intel_clients").select("*").eq("active", true).limit(50);

    if (!clients?.length) {
      return new Response(JSON.stringify({ message: "No active market intel clients" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    let processed = 0;

    for (const client of clients) {
      try {
        let newsContext = "";
        if (FIRECRAWL_API_KEY) {
          // Search industry news
          const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
            method: "POST",
            headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              query: `${client.industry || "business"} industry news ${client.location || "Michigan"} ${(client.focus_topics || []).join(" ")} this week`,
              limit: 8,
              tbs: "qdr:w",
              scrapeOptions: { formats: ["markdown"] } }) });
          const searchData = await searchRes.json();
          if (searchData?.data) {
            newsContext = searchData.data.map((r: any) => `**${r.title || ""}**\n${(r.markdown || r.description || "").slice(0, 800)}`).join("\n\n---\n\n");
          }

          // Search competitor moves
          if (client.competitors?.length) {
            for (const comp of client.competitors.slice(0, 3)) {
              try {
                const compRes = await fetch("https://api.firecrawl.dev/v1/search", {
                  method: "POST",
                  headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
                  body: JSON.stringify({ query: `"${comp}" news announcement`, limit: 3, tbs: "qdr:w" }) });
                const compData = await compRes.json();
                if (compData?.data?.length) {
                  newsContext += `\n\n--- Competitor: ${comp} ---\n${compData.data.map((r: any) => r.title || r.description || "").join("\n")}`;
                }
              } catch {}
            }
          }
        }

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite", 
            messages: [{
              role: "user",
              content: `Create a weekly market intelligence brief for ${client.business_name} (${client.industry || "general"} industry, ${client.location || "Michigan"}).

Focus topics: ${(client.focus_topics || []).join(", ") || "general industry trends"}
Competitors to watch: ${(client.competitors || []).join(", ") || "local competitors"}

News and data gathered this week:
${newsContext || "Use general industry knowledge for current trends."}

Format as a 2-minute-read HTML email:
1. **🔥 Top Story** — the one thing they need to know
2. **📊 Market Moves** — 3-4 bullet points of industry changes
3. **👀 Competitor Watch** — what competitors did this week
4. **💡 Opportunity Spotlight** — one actionable opportunity
5. **📅 This Week's Action Item** — one specific thing to do

Dark-themed professional HTML. Concise, scannable, executive-friendly.` }] }) });

        const aiData = await aiRes.json();
        const intelBrief = aiData?.choices?.[0]?.message?.content || "Unable to generate intelligence brief.";

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "M² Development <matt@mattmichelstraining.com>",
            to: [client.email],
            subject: `${client.business_name} — Weekly Market Intelligence Brief`,
            html: `<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;background:#1a1a2e;color:#e0e0e0;padding:32px;border-radius:12px;">
              <h1 style="color:#e8621a;text-align:center;">Weekly Market Intelligence</h1>
              <p style="color:#888;text-align:center;font-size:13px;">Week of ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
              ${intelBrief}
              <hr style="border-color:#333;margin:24px 0;">
              <p style="font-size:11px;color:#666;text-align:center;">Generated by M² Development AI Market Intelligence</p>
            <div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;">
        <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
        <div style="font-size:13px;color:#94a3b8;">
          <strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952
        </div>
        <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M² Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
      </div></div>` }) });

        await supabase.from("market_intel_clients").update({ last_sent_at: new Date().toISOString(), send_count: (client.send_count || 0) + 1 }).eq("id", client.id);
        processed++;
      } catch (err) {
        console.error(`Error processing market intel client ${client.id}:`, err);
      }
    }

    return new Response(JSON.stringify({ success: true, processed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
