import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

const STEP_PROMPTS: Record<number, string> = {
  1: "Write a warm welcome email for a new customer. Thank them for choosing the business, introduce the team briefly, and set expectations for what they can expect. Keep it under 200 words.",
  2: "Write a 'getting started' email for a new customer. Give them 3 clear steps to make the most of the product/service. Keep it actionable and under 200 words.",
  3: "Write a helpful tip email specific to the customer's industry. Share one valuable insight or best practice they can implement today. Keep it under 200 words.",
  4: "Write a friendly check-in email. Ask how things are going, if they have questions, and remind them of support options. Keep it under 150 words.",
  5: "Write a referral ask email. Thank them for being a customer, mention you'd love if they referred a friend/colleague, and offer to make it easy. Keep it under 150 words." };


const EMAIL_SIGNATURE = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div>`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get contacts ready for next drip
    const { data: contacts, error: contactsError } = await supabase
      .from("welcome_drip_contacts")
      .select("*")
      .eq("completed", false)
      .lte("next_send_at", new Date().toISOString());

    if (contactsError) {
      throw new Error(`Failed to query contacts: ${contactsError.message}`);
    }

    if (!contacts || contacts.length === 0) {
      return new Response(JSON.stringify({ message: "No drip emails to send" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let sent = 0;
    let errors = 0;

    for (const contact of contacts) {
      try {
        // Look up the client
        const { data: client } = await supabase
          .from("welcome_drip_clients")
          .select("*")
          .eq("client_email", contact.client_email)
          .eq("active", true)
          .single();

        if (!client) {
          console.error(`No active client for ${contact.client_email}`);
          errors++;
          continue;
        }

        const currentStep = contact.current_step || 1;
        const stepPrompt = STEP_PROMPTS[currentStep];

        // Generate email with Claude
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite", 
            messages: [
              {
                role: "user",
                content: `You are writing on behalf of ${client.business_name} (${client.industry || "local business"}). The customer's name is ${contact.contact_name}. ${stepPrompt}\n\nReturn ONLY the email body as HTML (no subject line, no wrapping). Use a friendly, professional tone. Sign off as the ${client.business_name} team.` },
            ] }) });

        if (!aiRes.ok) {
          console.error("Claude API error:", await aiRes.text());
          errors++;
          continue;
        }

        const aiData = await aiRes.json();
        const emailBody = aiData?.choices?.[0]?.message?.content;

        const stepSubjects: Record<number, string> = {
          1: `Welcome to ${client.business_name}!`,
          2: `Getting Started with ${client.business_name}`,
          3: `A Helpful Tip from ${client.business_name}`,
          4: `Quick Check-In from ${client.business_name}`,
          5: `Love Working with You — ${client.business_name}` };

        // Send email via Resend
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
            "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Matt Michels <matt@mattmichelstraining.com>",
            to: [contact.contact_email],
            subject: stepSubjects[currentStep],
            html: emailBody}) });

        if (!emailRes.ok) {
          console.error("Resend error:", await emailRes.text());
          errors++;
          continue;
        }

        // Update contact: advance step or mark completed
        const isCompleted = currentStep >= 5;
        const nextStep = currentStep + 1;
        const nextSendAt = new Date();
        nextSendAt.setDate(nextSendAt.getDate() + 3);

        await supabase
          .from("welcome_drip_contacts")
          .update({
            current_step: isCompleted ? 5 : nextStep,
            next_send_at: isCompleted ? null : nextSendAt.toISOString(),
            completed: isCompleted,
            last_sent_at: new Date().toISOString() })
          .eq("id", contact.id);

        // Increment client drip_count
        await supabase
          .from("welcome_drip_clients")
          .update({ drip_count: (client.drip_count || 0) + 1 })
          .eq("id", client.id);

        sent++;
      } catch (innerErr) {
        console.error(`Error processing contact ${contact.id}:`, innerErr);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, errors, total: contacts.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("welcome-drip-sender error:", err);
    return new Response(JSON.stringify({ error: (err instanceof Error ? err.message : "Unknown error") }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
