import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Check admin role using service client
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin } = await serviceClient.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request
    const { subject, body, from_name, from_email } = await req.json();

    if (!subject || !body) {
      return new Response(JSON.stringify({ error: "Subject and body are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch active subscribers
    const { data: subscribers, error: subError } = await serviceClient
      .from("newsletter_subscribers")
      .select("email")
      .eq("is_active", true);

    if (subError) {
      throw new Error(`Failed to fetch subscribers: ${subError.message}`);
    }

    if (!subscribers || subscribers.length === 0) {
      return new Response(JSON.stringify({ error: "No active subscribers found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert markdown-style bold to HTML
    const htmlBody = body
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");

    const senderEmail = from_email || "newsletter@resend.dev";
    const senderName = from_name || "Matt Michels · M² Training";

    // Send emails in batches of 50
    const batchSize = 50;
    let sentCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      const emails = batch.map((sub) => sub.email);

      // Resend batch send
      const resendRes = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          emails.map((email) => ({
            from: `${senderName} <${senderEmail}>`,
            to: [email],
            subject,
            html: `
              <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #d4cfc4; background-color: #151311;">
                <div style="border-bottom: 2px solid #e8621a; padding-bottom: 16px; margin-bottom: 24px;">
                  <h1 style="margin: 0; font-size: 18px; color: #e8621a; letter-spacing: -0.03em;">M² TRAINING</h1>
                  <p style="margin: 4px 0 0; font-size: 10px; color: #8a857a; letter-spacing: 0.1em; text-transform: uppercase;">The Real Deal · Monthly Newsletter</p>
                </div>
                <div style="font-size: 14px; line-height: 1.7;">
                  ${htmlBody}
                </div>
                <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #2e2b27; font-size: 11px; color: #8a857a;">
                  <p>You're receiving this because you subscribed to The Real Deal newsletter.</p>
                  <p>© M² Training · Real Training, Real Results</p>
                </div>
              </div>
            `,
          }))
        ),
      });

      if (!resendRes.ok) {
        const errBody = await resendRes.text();
        errors.push(`Batch ${i / batchSize + 1} failed [${resendRes.status}]: ${errBody}`);
      } else {
        await resendRes.json();
        sentCount += emails.length;
      }
    }

    // Log the send
    await serviceClient.from("newsletter_sends").insert({
      subject,
      body,
      sent_by: userId,
      recipient_count: sentCount,
    });

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        total: subscribers.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("send-newsletter error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
