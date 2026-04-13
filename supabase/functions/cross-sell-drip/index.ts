import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find unsent items where send_at has passed
    const { data: queue } = await supabase
      .from("cross_sell_queue")
      .select("*")
      .eq("sent", false)
      .lte("send_at", new Date().toISOString());

    if (!queue?.length) {
      return new Response(JSON.stringify({ message: "No items to send" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let sent = 0;

    for (const item of queue) {
      if (!item.email || !RESEND_API_KEY) continue;

      try {
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
            to: [item.email],
            subject: `${item.business_name || "Hey"} — Your Digital Infrastructure Audit Is Ready`,
            html: `<h2>Thanks for trusting us with your hardware.</h2>
              <p>Now let's make sure your <strong>digital infrastructure</strong> is just as solid.</p>
              <p>We noticed ${item.business_name ? item.business_name + " doesn't" : "you don't"} have an automated lead system online yet. That means you're leaving money on the table every single day.</p>
              <h3>Here's what we can do:</h3>
              <ul>
                <li>Free website diagnostic (60 seconds, no signup)</li>
                <li>Custom lead capture system built for your industry</li>
                <li>24/7 automated call routing so you never miss a customer</li>
              </ul>
              <p><a href="https://www.detroitwebagent.com/ai-website-audit">Get Your Free Diagnostic →</a></p>
              <p>— Matt Michels, Lead Web Agent<br/>Detroit Web Agency | Grosse Pointe, MI | (313) 992-1219</p>`,
          }),
        });

        await supabase.from("cross_sell_queue").update({ sent: true }).eq("id", item.id);
        sent++;
      } catch (e) {
        console.error(`Cross-sell email failed for ${item.email}:`, e);
      }
    }

    return new Response(JSON.stringify({ success: true, sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("cross-sell-drip error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
