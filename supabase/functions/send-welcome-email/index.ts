import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
  type: "INSERT";
  table: string;
  record: {
    user_id: string;
    type: string;
    body: string; // "email|programTitle"
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: WebhookPayload = await req.json();

    // Only handle program_welcome notifications
    if (payload.record?.type !== "program_welcome") {
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [email, programTitle] = payload.record.body.split("|");

    if (!email || !programTitle) {
      return new Response(JSON.stringify({ error: "Missing email or title" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subject = `Welcome to ${programTitle}. Here's step one.`;

    const htmlBody = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; color: #1a1a1a; line-height: 1.7;">
  <p style="font-size: 18px; font-weight: bold; margin-bottom: 24px;">You're in.</p>

  <p>Your program, <strong>${programTitle}</strong>, is locked and loaded in your M² Client Portal.</p>

  <p>I don't give busy work. Every movement in this program is there to rebuild your mechanics, bulletproof your joints, and build real strength.</p>

  <p style="font-weight: bold; margin-top: 28px;">Here is exactly what I need you to do next:</p>

  <ol style="padding-left: 20px;">
    <li style="margin-bottom: 12px;"><strong>Log into your portal</strong> and pull up Week 1, Day 1.</li>
    <li style="margin-bottom: 12px;"><strong>Read 'The Why'</strong> under the exercises. If you understand why we are doing it, you will do it better.</li>
    <li style="margin-bottom: 12px;"><strong>Do the work.</strong></li>
    <li style="margin-bottom: 12px;"><strong>Use the 'Flag Coach Matt' button.</strong> If a movement feels off, or you want me to check your form, record a quick video on your phone and upload it to the workout log. I will review it and get back to you with corrections.</li>
  </ol>

  <p style="margin-top: 28px;">Don't overthink it. Just execute Day 1.</p>

  <p style="margin-top: 28px;">Talk soon,</p>

  <p style="margin-bottom: 4px;"><strong>Matt Michels</strong></p>
  <p style="color: #888; font-size: 13px; margin-top: 0;">M² Training</p>
</div>
`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Matt Michels <matt@m2training.lovable.app>",
        to: [email],
        subject,
        html: htmlBody,
      }),
    });

    const data = await res.json();
    console.log("Resend response:", data);

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
