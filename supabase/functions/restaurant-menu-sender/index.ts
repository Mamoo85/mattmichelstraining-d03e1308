import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: clients } = await sb
    .from("restaurant_menu_clients")
    .select("*")
    .eq("active", true);

  if (!clients?.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
  }

  const currentMonth = new Date().toLocaleString("default", { month: "long" });

  let sent = 0;

  for (const client of clients) {
    const prompt = `Write compelling menu item descriptions for a ${client.cuisine_type || "American"} restaurant called ${client.business_name}. Generate 10 menu item descriptions (mix of appetizers, mains, desserts) that are seasonal for ${currentMonth}. Each description: 2-3 sentences, highlight key ingredients, evoke appetite. Use vivid, appetizing language.`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const aiData = await aiRes.json();
    const content = aiData.content?.[0]?.text || "";

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "matt@mattmichelstraining.com",
        to: client.email,
        subject: `Your Seasonal Menu Descriptions — ${currentMonth}`,
        bcc: ["matthewmichels@gmail.com"],
        html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${content}</pre>`,
      }),
    });

    sent++;
  }

  return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
});
