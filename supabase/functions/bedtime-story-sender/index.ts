// Bedtime Story Sender — cron daily 7pm ET
// Generates a unique AI bedtime story personalized for each child and emails it.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateText } from "../_shared/ai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const JSON_HEADERS = { "Content-Type": "application/json" };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" } });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: clients } = await (sb as any).from("bedtime_story_clients").select("*").eq("active", true);
  if (!clients?.length) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200, headers: JSON_HEADERS });
  }

  let sent = 0;

  for (const client of clients) {
    try {
      const interestsList = Array.isArray(client.interests)
        ? client.interests.join(", ")
        : String(client.interests || "animals and adventures");

      const story = await generateText(
        `Write a bedtime story for a child named ${client.child_name}, age ${client.child_age}, who loves ${interestsList}. Make ${client.child_name} the hero of the adventure. Keep it age-appropriate for a ${client.child_age}-year-old, about 400-500 words, with a happy ending and a gentle moral. Use vivid but simple language. Do not include any scary elements.`,
        800
      );

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#e8d5b7">
  <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;background:#fdf6e3;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.12)">
    <div style="background:#1e293b;padding:28px 32px;text-align:center">
      <div style="font-size:32px;margin-bottom:8px">🌙 ✨</div>
      <h1 style="color:#e8621a;margin:0;font-size:24px;font-family:Georgia,serif">Tonight's Adventure</h1>
      <p style="color:#94a3b8;margin:6px 0 0;font-size:15px;font-family:Georgia,serif">for ${client.child_name}</p>
    </div>
    <div style="padding:32px">
      <div style="font-size:16px;line-height:1.8;color:#3d2b1f;white-space:pre-wrap">${story}</div>
      <div style="margin-top:32px;padding:20px;background:#fff8ee;border-radius:8px;text-align:center;border:1px solid #f0d9b5">
        <p style="margin:0;font-size:16px;color:#7c5c3a;font-style:italic;font-family:Georgia,serif">
          Sweet dreams, ${client.child_name}! 🌟<br>See you tomorrow night for another adventure.
        </p>
      </div>
      <div style="margin-top:24px;text-align:center;font-size:11px;color:#b8a898;font-family:sans-serif">
        Delivered with love by M² Bedtime Stories · <a href="https://mattmichelstraining.com/unsubscribe" style="color:#b8a898">Unsubscribe</a>
      </div>
    </div>
  </div>
</body>
</html>`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Bedtime Stories <matt@mattmichelstraining.com>",
          to: [client.email],
          subject: `🌙 Tonight's Adventure for ${client.child_name}`,
          html,
        }),
      });

      sent++;
    } catch (e) {
      console.error(`[bedtime-story-sender] Error for ${client.email}:`, e);
    }
  }

  console.log(`[bedtime-story-sender] Sent ${sent} stories`);
  return new Response(JSON.stringify({ sent }), { status: 200, headers: JSON_HEADERS });
});
