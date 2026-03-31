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
    .from("linkedin_outreach_clients")
    .select("*")
    .eq("active", true);

  if (!clients?.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
  }

  let sent = 0;

  for (const client of clients) {
    const prompt = `Generate 5 personalized LinkedIn outreach messages for ${client.contact_name || "a B2B sales professional"} at ${client.business_name || "their company"} targeting ${client.target_title || "decision makers"} in ${client.industry || "their industry"}. Format: Message 1 (Connection Request, under 300 chars), Messages 2-5 (follow-up sequence, 1 per day, 150-200 words each). Use a helpful, peer-to-peer tone. No spam language.`;

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
        subject: "Your LinkedIn Outreach Sequences This Week",
        bcc: ["matthewmichels@gmail.com"],
        html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${content}</pre>`,
      }),
    });

    sent++;
  }

  return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
});
