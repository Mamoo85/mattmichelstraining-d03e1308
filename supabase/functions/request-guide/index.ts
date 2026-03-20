import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { request, email } = await req.json();

    if (!request || typeof request !== "string" || request.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Request text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (request.length > 500) {
      return new Response(JSON.stringify({ error: "Request too long" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "M² Training <onboarding@resend.dev>",
        to: ["matthewmichels4@gmail.com", "info@mattmichelstraining.com"],
        subject: `📋 New Guide Request from ${email || "anonymous"}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #E8621A; margin-bottom: 16px;">New Guide Request</h2>
            <div style="background: #f5f5f5; padding: 16px; border-left: 4px solid #E8621A; margin-bottom: 16px;">
              <p style="margin: 0; font-size: 16px; font-weight: bold;">"${request.trim()}"</p>
            </div>
            <p style="color: #666; font-size: 14px;"><strong>From:</strong> ${email || "Not logged in"}</p>
            <p style="color: #666; font-size: 14px;"><strong>Submitted:</strong> ${new Date().toLocaleString("en-US", { timeZone: "America/Detroit" })}</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
            <p style="color: #999; font-size: 12px;">This request was submitted from the M² Training store.</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      throw new Error("Failed to send email");
    }

    await res.json();

    return new Response(JSON.stringify({ success: true }), {
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
