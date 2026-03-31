import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

serve(async (_req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const { data: clients } = await sb.from("local_seo_clients").select("*").eq("active", true);
    if (!clients?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });

    let sent = 0;
    for (const client of clients) {
      try {
        const aiRes = await fetch("https://ai.lovable.dev/api/chat", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: `Write a local SEO landing page for "${client.business_name}" (${client.industry || "local business"}) serving ${client.city || "the local area"}.\n\nInclude:\n1. H1 headline with city + service\n2. 3 content sections (about services, why choose us, service area)\n3. 5 FAQ items with schema-ready Q&A format\n4. Meta title (under 60 chars) + meta description (under 160 chars)\n5. 3 internal linking anchor text suggestions\n\nFormat as clean HTML. Make it feel local and genuine.` }],
          }),
        });
        const aiData = await aiRes.json();
        const content = aiData?.choices?.[0]?.message?.content || "<p>Content unavailable this month.</p>";

        if (RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "M² Local SEO <matt@notify.m2training.com>",
              to: [client.email],
              subject: `Your New Local SEO Page — ${client.city || "your area"} ${client.industry || "services"}`,
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#1e293b;color:#e2e8f0;border-radius:12px;"><h2 style="color:#e8621a;">🗺️ Monthly Local SEO Page</h2><p>Here's your new landing page content — paste it into your website as a new page:</p><hr style="border-color:#334155;">${content}<hr style="border-color:#334155;"><p style="color:#94a3b8;">Adding this page helps you rank for "${client.industry} in ${client.city}" searches.</p><p style="color:#64748b;font-size:12px;">Powered by M² Performance — matt@m2training.com</p></div>`,
            }),
          });
        }

        await sb.from("local_seo_clients").update({ page_count: (client.page_count || 0) + 1, last_generated_at: new Date().toISOString() }).eq("id", client.id);
        sent++;
      } catch (e) { console.error(`[LOCAL-SEO-MONTHLY] Error for ${client.email}:`, e); }
    }
    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (e: any) { console.error("[LOCAL-SEO-MONTHLY] Fatal:", e); return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
});
