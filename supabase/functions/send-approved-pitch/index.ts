import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const { leadId, subject, body } = await req.json();
    if (!leadId) {
      return new Response(JSON.stringify({ error: "leadId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the lead
    const { data: lead, error: fetchError } = await supabase
      .from("outreach_leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (fetchError || !lead) {
      throw new Error(fetchError?.message || "Lead not found");
    }

    if (!lead.email) {
      return new Response(JSON.stringify({ error: "Lead has no email address" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailSubject = subject || lead.ai_drafted_subject || `Quick question about ${lead.business_name}`;
    const emailBody = body || lead.ai_drafted_pitch;

    if (!emailBody) {
      return new Response(JSON.stringify({ error: "No pitch draft available to send" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert plain text to simple HTML
    const htmlBody = emailBody
      .split("\n")
      .map((line: string) => line.trim() === "" ? "<br>" : `<p style="margin:0 0 8px 0;font-family:Arial,sans-serif;font-size:14px;color:#333;">${line}</p>`)
      .join("\n");

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Matt Michels <matt@mattmichelstraining.com>",
        to: [lead.email],
        bcc: ["matthewmichels4@gmail.com"],
        subject: emailSubject,
        html: htmlBody,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      console.error("Resend error:", resendRes.status, errBody);
      throw new Error(`Resend error: ${resendRes.status} - ${errBody}`);
    }

    // Update lead status to contacted
    const { error: updateError } = await supabase
      .from("outreach_leads")
      .update({
        status: "contacted",
        last_contact_date: new Date().toISOString(),
      })
      .eq("id", leadId);

    if (updateError) {
      console.error("Failed to update lead status:", updateError);
    }

    return new Response(JSON.stringify({ success: true, sentTo: lead.email }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-approved-pitch]", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
