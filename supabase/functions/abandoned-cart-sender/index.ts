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
    .from("abandoned_cart_clients")
    .select("*")
    .eq("active", true);

  if (!clients?.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
  }

  let sent = 0;

  for (const client of clients) {
    const prompt = `Write a 3-email abandoned cart recovery sequence for ${client.business_name || "an e-commerce store"} on ${client.platform || "Shopify"}. Email 1 (1hr after abandon, friendly reminder), Email 2 (24hr, social proof + urgency), Email 3 (48hr, discount offer). Each email: subject line + body (150-200 words). Professional but warm tone.`;

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
        from: "matt@notify.m2training.com",
        to: client.email,
        subject: "Your Abandoned Cart Recovery Emails This Week",
        bcc: ["matthewmichels@gmail.com"],
        html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${content}</pre>`,
      }),
    });

    sent++;
  }

  return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
});
