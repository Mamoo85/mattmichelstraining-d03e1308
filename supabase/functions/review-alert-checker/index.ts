import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY") || "";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { clientEmail, reviewerName, rating, reviewText, platform } = await req.json();

    if (!clientEmail || !reviewerName || !rating || !platform) {
      return new Response(JSON.stringify({ error: "Missing required fields: clientEmail, reviewerName, rating, platform" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: client, error: clientError } = await supabase.from("review_alert_clients").select("*").eq("client_email", clientEmail).eq("active", true).single();
    if (clientError || !client) {
      return new Response(JSON.stringify({ error: "Client not found or inactive" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await supabase.from("review_alerts_log").insert({ client_email: clientEmail, reviewer_name: reviewerName, rating, review_text: reviewText || "", platform, created_at: new Date().toISOString() });

    const smsBody = `${client.business_name}: New ${rating}-star review from ${reviewerName} on ${platform}! Check it now.`;

    if (client.phone_number && LOVABLE_API_KEY && TWILIO_API_KEY) {
      const smsRes = await fetch(`${GATEWAY_URL}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TWILIO_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: client.phone_number, From: client.twilio_number || "", Body: smsBody }),
      });
      if (!smsRes.ok) console.error("Twilio gateway SMS failed:", await smsRes.text());
    }

    const stars = "⭐".repeat(Math.min(rating, 5));
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Matt Michels <matt@mattmichelstraining.com>",
        to: [client.client_email], bcc: ["matthewmichels4@gmail.com"],
        subject: `${stars} New ${rating}-Star Review on ${platform}`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;"><h2 style="color:#1e293b;">New Review Alert for ${client.business_name}</h2><div style="background:#f8fafc;border-left:4px solid ${rating >= 4 ? "#22c55e" : rating >= 3 ? "#eab308" : "#ef4444"};padding:16px;margin:16px 0;border-radius:4px;"><p style="margin:0 0 8px;"><strong>Reviewer:</strong> ${reviewerName}</p><p style="margin:0 0 8px;"><strong>Rating:</strong> ${stars} (${rating}/5)</p><p style="margin:0 0 8px;"><strong>Platform:</strong> ${platform}</p><p style="margin:0;"><strong>Review:</strong></p><p style="margin:4px 0 0;color:#475569;">${reviewText || "No text provided"}</p></div><p style="color:#64748b;font-size:14px;">Tip: ${rating >= 4 ? "Thank this customer publicly!" : "Consider reaching out privately to address their concerns."}</p><div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;">
        <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
        <div style="font-size:13px;color:#94a3b8;">
          <strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952
        </div>
        <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M² Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
      </div></div>`,
      }),
    });
    if (!emailRes.ok) console.error("Resend email failed:", await emailRes.text());

    await supabase.from("review_alert_clients").update({ alert_count: (client.alert_count || 0) + 1 }).eq("id", client.id);

    return new Response(JSON.stringify({ success: true, message: "Review alert sent" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("review-alert-checker error:", err);
    return new Response(JSON.stringify({ error: (err instanceof Error ? err.message : "Unknown error") }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
