import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all active reactivation clients
    const { data: clients, error: clientsError } = await supabase
      .from("reactivation_email_clients")
      .select("*")
      .eq("active", true);

    if (clientsError) {
      throw new Error(`Failed to query clients: ${clientsError.message}`);
    }

    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ message: "No active reactivation clients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let totalSent = 0;
    let totalErrors = 0;

    for (const client of clients) {
      try {
        // Get contacts for this client
        const { data: contacts, error: contactsError } = await supabase
          .from("reactivation_contacts")
          .select("*")
          .eq("client_email", client.client_email);

        if (contactsError || !contacts || contacts.length === 0) {
          console.log(`No contacts for ${client.client_email}`);
          continue;
        }

        for (const contact of contacts) {
          try {
            // Generate personalized reactivation email with Claude
            const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-lite", 
                messages: [
                  {
                    role: "user",
                    content: `Write a personalized "we miss you" reactivation email from "${client.business_name}" (${client.industry || "local business"}) to a past customer named "${contact.contact_name}".

The email should:
- Reference their name naturally
- Acknowledge it's been a while since they visited/purchased
- Share one compelling reason to come back (new product, improvement, seasonal relevance)
- Include a special "come back" offer (e.g., 15% off, free consultation, etc.)
- Have a clear call to action
- Be warm and genuine, not pushy
- Be under 200 words

Return ONLY the HTML email body. No subject line. Sign off as the ${client.business_name} team.` },
                ] }) });

            if (!aiRes.ok) {
              console.error("Claude API error:", await aiRes.text());
              totalErrors++;
              continue;
            }

            const aiData = await aiRes.json();
            const emailBody = aiData.content[0].text;

            // Send via Resend
            const emailRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
                "Content-Type": "application/json" },
              body: JSON.stringify({
                from: "Matt Michels <matt@notify.m2training.com>",
                to: [contact.contact_email],
                subject: `We miss you, ${contact.contact_name}! — ${client.business_name}`,
                html: `
                  <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
                    ${emailBody}
                  </div>
                ` }) });

            if (!emailRes.ok) {
              console.error("Resend error:", await emailRes.text());
              totalErrors++;
              continue;
            }

            totalSent++;
          } catch (contactErr) {
            console.error(`Error emailing contact ${contact.id}:`, contactErr);
            totalErrors++;
          }
        }

        // Update email_count for this client
        await supabase
          .from("reactivation_email_clients")
          .update({ email_count: (client.email_count || 0) + contacts.length })
          .eq("id", client.id);
      } catch (clientErr) {
        console.error(`Error processing client ${client.id}:`, clientErr);
        totalErrors++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: totalSent, errors: totalErrors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("reactivation-email-sender error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
