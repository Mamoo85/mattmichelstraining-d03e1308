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

    // Verify admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin } = await serviceClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subject, body, audience, csv_emails, from_name, from_email, template_name } = await req.json();

    if (!subject || !body) {
      return new Response(JSON.stringify({ error: "Subject and body are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve recipient emails based on audience
    let emails: string[] = [];
    const audienceType = audience || "subscribers";

    if (audienceType === "csv" && Array.isArray(csv_emails)) {
      emails = csv_emails;
    } else if (audienceType === "all_users") {
      const { data, error } = await serviceClient
        .from("profiles")
        .select("email")
        .not("email", "is", null);
      if (error) throw new Error(`Failed to fetch users: ${error.message}`);
      emails = (data || []).map((r: any) => r.email).filter(Boolean);
    } else if (audienceType === "trial_users") {
      const { data, error } = await serviceClient
        .from("profiles")
        .select("email")
        .not("trial_started_at", "is", null)
        .eq("subscription_tier", "free")
        .not("email", "is", null);
      if (error) throw new Error(`Failed to fetch trial users: ${error.message}`);
      emails = (data || []).map((r: any) => r.email).filter(Boolean);
    } else {
      // Default: active newsletter subscribers
      const { data, error } = await serviceClient
        .from("newsletter_subscribers")
        .select("email")
        .eq("is_active", true);
      if (error) throw new Error(`Failed to fetch subscribers: ${error.message}`);
      emails = (data || []).map((r: any) => r.email).filter(Boolean);
    }

    // Deduplicate
    emails = [...new Set(emails.map((e: string) => e.toLowerCase().trim()))];

    if (emails.length === 0) {
      return new Response(JSON.stringify({ error: "No recipients found for selected audience" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert markdown bold to HTML
    const htmlBody = body
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");

    const senderEmail = from_email || "newsletter@resend.dev";
    const senderName = from_name || "Matt Michels · M² Training";

    // Send in batches of 50
    const batchSize = 50;
    let sentCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      const resendRes = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          batch.map((email: string) => ({
            from: `${senderName} <${senderEmail}>`,
            to: [email], bcc: ["matthewmichels4@gmail.com"],
            subject,
            html: `
              <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #d4cfc4; background-color: #151311;">
                <div style="border-bottom: 2px solid #e8621a; padding-bottom: 16px; margin-bottom: 24px;">
                  <h1 style="margin: 0; font-size: 18px; color: #e8621a; letter-spacing: -0.03em;">M² TRAINING</h1>
                  <p style="margin: 4px 0 0; font-size: 10px; color: #8a857a; letter-spacing: 0.1em; text-transform: uppercase;">The Real Deal · Broadcast</p>
                </div>
                <div style="font-size: 14px; line-height: 1.7;">
                  ${htmlBody}
                </div>
                <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #2e2b27; font-size: 11px; color: #8a857a;">
                  <p>You're receiving this from M² Training.</p>
                  <p>© M² Training · Real Training, Real Results</p>
                </div>
              <div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;">
        <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
        <div style="font-size:13px;color:#94a3b8;">
          <strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952
        </div>
        <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M² Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
      </div></div>
            `,
          }))
        ),
      });

      if (!resendRes.ok) {
        const errBody = await resendRes.text();
        errors.push(`Batch ${i / batchSize + 1} failed [${resendRes.status}]: ${errBody}`);
      } else {
        await resendRes.json();
        sentCount += batch.length;
      }
    }

    // Log the send
    await serviceClient.from("newsletter_sends").insert({
      subject,
      body,
      sent_by: user.id,
      recipient_count: sentCount,
      template_name: template_name || `broadcast_${audienceType}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        total: emails.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-newsletter error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
