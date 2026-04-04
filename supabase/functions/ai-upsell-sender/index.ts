import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const SERVICE_CATALOG = [
  { name: "AI Reputation Dashboard", price: "$79/mo", desc: "Weekly review monitoring and response suggestions", best_for: ["restaurants", "contractors", "medical", "retail"] },
  { name: "Review Request SMS", price: "$39/mo", desc: "Automated review requests via text", best_for: ["contractors", "medical", "auto", "restaurants"] },
  { name: "AI Blog Posts", price: "$79/mo", desc: "4 SEO blog posts monthly", best_for: ["all"] },
  { name: "AI Newsletter Service", price: "$99/mo", desc: "Monthly customer newsletter", best_for: ["all"] },
  { name: "Google Ads Copy", price: "$39/mo", desc: "10 ad variations monthly", best_for: ["contractors", "medical", "legal", "real_estate"] },
  { name: "Local SEO Pages", price: "$59/mo", desc: "City-specific landing pages", best_for: ["contractors", "medical", "auto", "legal"] },
  { name: "Competitor Watch", price: "$69/mo", desc: "Weekly competitor intelligence", best_for: ["all"] },
  { name: "Missed Call Text-Back", price: "$99/mo", desc: "Auto-text when you miss a call", best_for: ["contractors", "medical", "auto", "restaurants"] },
  { name: "Speed-to-Lead SMS", price: "$39/mo", desc: "Instant response to new leads", best_for: ["contractors", "real_estate", "auto"] },
  { name: "Late Payment Chaser", price: "$29/mo", desc: "AI payment reminders", best_for: ["contractors"] },
];

serve(async (_req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    // Find all B2B clients across all tables who subscribed 14+ days ago
    const tables = [
      "reputation_clients", "newsletter_service_clients", "faq_refresh_clients",
      "blog_post_clients", "ads_copy_clients", "competitor_watch_clients",
      "local_seo_clients", "payment_chaser_clients",
    ];

    const clientMap = new Map<string, { email: string; business_name: string; industry: string; services: string[] }>();

    for (const table of tables) {
      try {
        const cutoff = new Date(Date.now() - 14 * 86400000).toISOString();
        const { data } = await sb.from(table).select("email, business_name, industry, created_at").eq("active", true).lt("created_at", cutoff);
        if (data) {
          for (const c of data) {
            const key = c.email;
            if (!clientMap.has(key)) {
              clientMap.set(key, { email: c.email, business_name: c.business_name, industry: c.industry || "general", services: [] });
            }
            clientMap.get(key)!.services.push(table.replace("_clients", "").replace(/_/g, " "));
          }
        }
      } catch { /* skip */ }
    }

    let sent = 0;
    for (const [email, client] of clientMap) {
      // Check if we already upsold this client
      const { data: existing } = await sb.from("upsell_emails_sent").select("id").eq("client_email", email).limit(1);
      if (existing?.length) continue;

      // Find services they don't have
      const available = SERVICE_CATALOG.filter(s => 
        !client.services.some(cs => s.name.toLowerCase().includes(cs)) &&
        (s.best_for.includes("all") || s.best_for.some(bf => client.industry.toLowerCase().includes(bf)))
      ).slice(0, 3);

      if (available.length === 0) continue;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [{ role: "user", content: `Write a short, friendly upsell email from Matt at M2 Development to ${client.business_name} (${client.industry}). They currently use: ${client.services.join(", ")}.\n\nRecommend these additional services:\n${available.map(a => `- ${a.name} (${a.price}): ${a.desc}`).join("\n")}\n\nKeep it under 150 words, personal, mention how these complement what they already use. Sign off as Matt.` }],
        }),
      });
      const aiData = await aiRes.json();
      const body = aiData?.choices?.[0]?.message?.content || "";

      if (RESEND_API_KEY && body) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Matt Michels <matt@mattmichelstraining.com>",
            to: [email], bcc: ["matthewmichels4@gmail.com"],
            subject: `Quick idea for ${client.business_name}`,
        bcc: ["matthewmichels@gmail.com"],
            html: `<div style="font-family:sans-serif;max-width:500px;padding:20px;">${body.replace(/\n/g, "<br>")}<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;">
        <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
        <div style="font-size:13px;color:#94a3b8;">
          <strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952
        </div>
        <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M² Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
      </div></div>`,
          }),
        });
      }

      await sb.from("upsell_emails_sent").insert({
        client_email: email,
        service_name: client.services[0],
        recommended_services: available.map(a => a.name),
      });
      sent++;
    }

    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); return new Response(JSON.stringify({ error: msg }), { status: 500 }); }
});
