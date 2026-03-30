import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { clientEmail, reviewerName, rating, reviewText, platform } = await req.json();

    if (!clientEmail || !reviewerName || !rating || !platform) {
      return new Response(JSON.stringify({ error: "Missing required fields: clientEmail, reviewerName, rating, platform" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up client
    const { data: client, error: clientError } = await supabase
      .from("review_alert_clients")
      .select("*")
      .eq("client_email", clientEmail)
      .eq("active", true)
      .single();

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: "Client not found or inactive" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the review
    await supabase.from("review_alerts_log").insert({
      client_email: clientEmail,
      reviewer_name: reviewerName,
      rating,
      review_text: reviewText || "",
      platform,
      created_at: new Date().toISOString(),
    });

    // Send SMS alert via Twilio
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN")!;

    const stars = "⭐".repeat(Math.min(rating, 5));
    const smsBody = `${client.business_name}: New ${rating}-star review from ${reviewerName} on ${platform}! Check it now.`;

    if (client.phone_number) {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const smsParams = new URLSearchParams({
        To: client.phone_number,
        From: client.twilio_number || Deno.env.get("TWILIO_FROM_NUMBER") || "",
        Body: smsBody,
      });

      const smsRes = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${twilioSid}:${twilioAuth}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: smsParams.toString(),
      });

      if (!smsRes.ok) {
        console.error("Twilio SMS failed:", await smsRes.text());
      }
    }

    // Email the full review to the client
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Matt Michels <matt@notify.m2training.com>",
        to: [client.client_email],
        subject: `${stars} New ${rating}-Star Review on ${platform}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#1e293b;">New Review Alert for ${client.business_name}</h2>
            <div style="background:#f8fafc;border-left:4px solid ${rating >= 4 ? "#22c55e" : rating >= 3 ? "#eab308" : "#ef4444"};padding:16px;margin:16px 0;border-radius:4px;">
              <p style="margin:0 0 8px;"><strong>Reviewer:</strong> ${reviewerName}</p>
              <p style="margin:0 0 8px;"><strong>Rating:</strong> ${stars} (${rating}/5)</p>
              <p style="margin:0 0 8px;"><strong>Platform:</strong> ${platform}</p>
              <p style="margin:0;"><strong>Review:</strong></p>
              <p style="margin:4px 0 0;color:#475569;">${reviewText || "No text provided"}</p>
            </div>
            <p style="color:#64748b;font-size:14px;">Tip: ${rating >= 4 ? "Thank this customer publicly!" : "Consider reaching out privately to address their concerns."}</p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      console.error("Resend email failed:", await emailRes.text());
    }

    // Increment alert_count
    await supabase
      .from("review_alert_clients")
      .update({ alert_count: (client.alert_count || 0) + 1 })
      .eq("id", client.id);

    return new Response(
      JSON.stringify({ success: true, message: "Review alert sent" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("review-alert-checker error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
