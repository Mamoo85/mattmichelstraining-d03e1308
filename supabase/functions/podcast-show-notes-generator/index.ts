import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    // Called manually or via cron — process any pending episodes
    const { data: clients } = await (sb.from as any)("podcast_show_notes_clients").select("*").eq("active", true);
    if (!clients?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200, headers: cors });

    let sent = 0;
    for (const client of clients) {
      try {
        const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
        // Generate a template pack — clients email their episode for on-demand generation
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: `Write a podcast show notes template pack for "${client.business_name}"${client.podcast_url ? " (podcast: " + client.podcast_url + ")" : ""}.

Include:
1. Complete show notes template (fill-in-the-blank format) with: episode summary, key takeaways, guest bio section, timestamps placeholder, resources mentioned, call to action
2. 3 SEO-optimized episode title formulas
3. 5 podcast episode description templates (for different episode types: interview, solo, roundtable, case study, Q&A)
4. Social media caption templates for promoting episodes (Instagram, LinkedIn, Twitter/X)

Reminder: To get show notes written for a specific episode, simply email your episode link or transcript to matt@mattmichelstraining.com and we'll have your notes back within 24 hours.

Month: ${month}` }],
          }),
        });
        const aiData = await aiRes.json();
        const content = aiData?.choices?.[0]?.message?.content || "Templates unavailable this month.";

        if (RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "M² Development <matt@mattmichelstraining.com>",
              to: [client.email], bcc: ["matthewmichels4@gmail.com"],
              subject: `${client.business_name} — ${month} Show Notes Templates`,
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#1e293b;color:#e2e8f0;border-radius:12px;"><h2 style="color:#e8621a;">🎙️ Monthly Podcast Show Notes Pack</h2><p>Here are your ${month} templates. For custom show notes on a specific episode, email the link or transcript to <a href="mailto:matt@mattmichelstraining.com" style="color:#e8621a;">matt@mattmichelstraining.com</a> and we'll have notes back within 24 hours.</p><pre style="white-space:pre-wrap;font-family:sans-serif;color:#e2e8f0;">${content}</pre><p style="color:#64748b;font-size:12px;">Powered by M² Development — matt@mattmichelstraining.com</p></div>`,
            }),
          });
        }
        await (sb.from as any)("podcast_show_notes_clients").update({ last_sent_at: new Date().toISOString() }).eq("id", client.id);
        sent++;
      } catch (e) { console.error(`[PODCAST-NOTES-SENDER] Error for ${client.email}:`, e); }
    }
    return new Response(JSON.stringify({ ok: true, sent }), { status: 200, headers: cors });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); return new Response(JSON.stringify({ error: msg }), { status: 500, headers: cors }); }
});
