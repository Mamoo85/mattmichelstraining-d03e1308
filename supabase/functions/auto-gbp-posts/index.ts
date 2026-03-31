import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const log = (msg: string, data?: any) =>
  console.log(`[AUTO-GBP-POSTS] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const week = new Date().toISOString().slice(0, 10);

    const { data: clients, error } = await sb
      .from("gbp_management_clients" as any)
      .select("*")
      .eq("status", "active");

    if (error) throw error;
    if (!clients || clients.length === 0) {
      log("No active GBP clients");
      return new Response(JSON.stringify({ posts_generated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let generated = 0;

    for (const client of clients) {
      const templateName = `gbp_post_${client.id}_${week}`;

      // Dedup check
      const { data: alreadySent } = await sb
        .from("email_send_log")
        .select("id")
        .eq("template_name", templateName)
        .maybeSingle();
      if (alreadySent) continue;

      // Generate post content via AI
      let postContent = "";
      if (LOVABLE_API_KEY) {
        const prompt = `Write a Google Business Profile post for ${client.business_name}, a local business in Metro Detroit. 150-200 words. Highlight services, current promotions, or seasonal relevance. Include a clear call to action (call us, visit us, book now, etc.). Professional but approachable tone. Do NOT mention AI or that this was generated automatically.`;

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 300,
            temperature: 0.7,
          }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          postContent = aiData.choices?.[0]?.message?.content || "";
        }
      }

      if (!postContent) {
        postContent = `${client.business_name} is your trusted local partner in Metro Detroit. Contact us today to learn more about our services and how we can help you. Call or visit us — we'd love to hear from you!`;
      }

      // Email admin with the generated post
      if (RESEND_API_KEY) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "M² Site <matt@mattmichelstraining.com>",
            to: ["matt@m2training.com"], bcc: ["matthewmichels4@gmail.com"],
            subject: `GBP Post Ready — ${client.business_name} (${week})`,
            html: `
              <p><strong>Business:</strong> ${client.business_name}</p>
              <p><strong>Week of:</strong> ${week}</p>
              <hr>
              <p><strong>Post Content:</strong></p>
              <blockquote style="border-left:3px solid #f97316;padding:8px 16px;background:#fff8f0;">
                ${postContent.replace(/\n/g, "<br>")}
              </blockquote>
              <p style="color:#888;font-size:12px;">Copy this text and post it to ${client.business_name}'s Google Business Profile.</p>
              ${client.current_gbp_url ? `<p><a href="${client.current_gbp_url}">Open GBP Profile →</a><div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI \u00b7 (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div></p>` : ""}
            `,
          }),
        });

        if (res.ok) {
          await sb.from("email_send_log").insert({
            template_name: templateName,
            recipient_email: "matt@m2training.com",
          });
          generated++;
          log("GBP post generated", { business: client.business_name, week });
        }
      }

      await new Promise((r) => setTimeout(r, 500));
    }

    return new Response(JSON.stringify({ posts_generated: generated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[AUTO-GBP-POSTS] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
