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
    .from("trade_show_followup_clients")
    .select("*")
    .eq("active", true);

  if (!clients?.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
  }

  let sent = 0;

  for (const client of clients) {
    const prompt = `Write a 5-email post-trade-show follow-up sequence for ${client.business_name} in the ${client.industry || "B2B"} industry. Email 1 (Day 1, warm same-day follow-up), Email 2 (Day 3, value-add with resource), Email 3 (Day 7, case study or proof), Email 4 (Day 14, meeting ask), Email 5 (Day 21, final breakup email). Each: subject line + 120-150 word body. Assumes leads were collected at the show booth.`;

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
        subject: "Your Trade Show Follow-Up Sequence",
        bcc: ["matthewmichels@gmail.com"],
        html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${content}</pre>`,
      }),
    });

    sent++;
  }

  return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
});
