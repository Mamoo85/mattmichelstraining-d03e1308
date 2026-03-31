import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

serve(async (_req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const { data: clients } = await sb.from("blog_post_clients").select("*").eq("active", true);
    if (!clients?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });

    let sent = 0;
    for (const client of clients) {
      try {
        const keywords = (client.target_keywords || []).join(", ") || client.industry || "general";
        const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: `Write 4 SEO blog posts for "${client.business_name}" (${client.industry || "local business"}) for ${month}.\n\nTarget keywords: ${keywords}\n\nFor each post provide:\n- Title (H1)\n- Meta description (under 160 chars)\n- 400-600 word body with H2 subheadings\n- Internal linking suggestions\n\nSeparate each post with "---POST---". Format body as clean HTML.` }],
          }),
        });
        const aiData = await aiRes.json();
        const content = aiData?.choices?.[0]?.message?.content || "<p>Blog posts unavailable this month.</p>";

        if (RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "M² Blog Service <matt@mattmichelstraining.com>",
              to: [client.email], bcc: ["matthewmichels4@gmail.com"],
              subject: `Your ${month} Blog Posts Are Ready — ${client.business_name}`,
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#1e293b;color:#e2e8f0;border-radius:12px;"><h2 style="color:#e8621a;">📝 Monthly Blog Posts</h2><p>Here are your 4 SEO-optimized blog posts for ${month}. Copy and paste each one into your website's blog:</p><hr style="border-color:#334155;">${content}<hr style="border-color:#334155;"><p style="color:#64748b;font-size:12px;">Powered by M² Performance — matt@m2training.com</p><div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;">
        <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
        <div style="font-size:13px;color:#94a3b8;">
          <strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952
        </div>
        <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M² Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
      </div></div>`,
            }),
          });
        }

        await sb.from("blog_post_clients").update({ post_count: (client.post_count || 0) + 4, last_sent_at: new Date().toISOString() }).eq("id", client.id);
        sent++;
      } catch (e) { console.error(`[BLOG-MONTHLY] Error for ${client.email}:`, e); }
    }
    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (e: any) { console.error("[BLOG-MONTHLY] Fatal:", e); return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
});
