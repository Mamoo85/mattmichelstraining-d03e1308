// GBP SaaS Poster — called Mon/Wed/Fri by cron
// Generates an AI post for each active GBP SaaS client and posts it to their Google Business Profile

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

async function generatePost(businessName: string, businessType: string, city: string): Promise<string> {
  if (!LOVABLE_API_KEY) return `${businessName} is here to help with all your ${businessType} needs in ${city}. Call us today!`;

  const postTypes = [
    `Write a Google Business Profile post for ${businessName}, a ${businessType} in ${city}. Focus on a seasonal tip or service reminder. 1-3 sentences. No hashtags. Sound like a real local business owner, not a marketer.`,
    `Write a short Google Business Profile update for ${businessName} (${businessType}, ${city}) highlighting their reliability and local experience. 1-3 sentences. Conversational and genuine.`,
    `Write a "did you know" style GBP post for ${businessName}, a ${businessType} serving ${city}. Share a useful fact or tip relevant to their industry. 2-3 sentences.`,
    `Write a customer-focused GBP post for ${businessName} in ${city} (${businessType}). Mention that they're taking new clients/customers. 1-2 sentences. Direct and local.`,
  ];

  const prompt = postTypes[Math.floor(Date.now() / 86400000) % postTypes.length];

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite", 
      messages: [{ role: "user", content: prompt }] }) });

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || `${businessName} — serving ${city} with quality ${businessType} services. Call today!`;
}

async function postToGBP(locationId: string, accessToken: string, content: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/-/locations/${locationId}/localPosts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json" },
        body: JSON.stringify({
          languageCode: "en-US",
          summary: content,
          topicType: "STANDARD" }) }
    );
    return res.ok;
  } catch {
    return false;
  }
}

serve(async (req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { data: clients } = await sb
      .from("gbp_saas_clients")
      .select("id, business_name, business_type, city, state, gbp_location_id, gbp_access_token, email, post_count")
      .eq("active", true)
      .eq("intake_completed", true);

    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ posted: 0 }), { status: 200 });
    }

    let posted = 0;
    let failed = 0;

    for (const client of clients) {
      const content = await generatePost(
        client.business_name,
        client.business_type || "local business",
        `${client.city || ""}${client.state ? ", " + client.state : ""}`
      );

      let success = false;
      if (client.gbp_location_id && client.gbp_access_token) {
        success = await postToGBP(client.gbp_location_id, client.gbp_access_token, content);
      }

      if (success) {
        await sb.from("gbp_saas_clients").update({
          last_post_at: new Date().toISOString(),
          post_count: (client.post_count || 0) + 1 }).eq("id", client.id);
        posted++;
      } else {
        // GBP not connected yet — save the content and email Matt to follow up
        failed++;
        if (RESEND_API_KEY && client.email) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "M² Local Marketing <matt@mattmichelstraining.com>",
              to: ["matt@m2training.com"], bcc: ["matthewmichels4@gmail.com"],
              subject: `GBP post ready — ${client.business_name} (needs connection)`,
              html: `<p>${client.business_name} (${client.email}) doesn't have GBP connected yet. Post ready to go:<br><br><em>"${content}"</em><br><br>Reply to this to let them know.<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI \u00b7 (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div></p>` }) });
        }
      }
    }

    console.log(`[GBP-POSTER] Posted: ${posted}, Failed/pending: ${failed}`);
    return new Response(JSON.stringify({ posted, failed }), { status: 200 });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e);
    console.error("[GBP-POSTER] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
