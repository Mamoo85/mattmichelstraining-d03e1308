import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const EMAIL_SIGNATURE = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div>`;

const log = (msg: string, data?: any) =>
  console.log(`[DELIVER-SEO-PACKAGE] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

serve(async (req: Request) => {
  try {
    const { stripe_session_id, customer_email, business_name, city, industry } = await req.json();

    if (!stripe_session_id || !customer_email || !business_name || !city || !industry) {
      return new Response(
        JSON.stringify({ error: "Missing required fields." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const templateName = `seo_package_${stripe_session_id}`;

    // Dedup check
    const { data: existing } = await supabase
      .from("email_send_log")
      .select("id")
      .eq("template_name", templateName)
      .maybeSingle();

    if (existing) {
      log("Already sent, skipping", { stripe_session_id });
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check suppressed emails
    const { data: suppressed } = await supabase
      .from("suppressed_emails")
      .select("id")
      .eq("email", customer_email)
      .maybeSingle();

    if (suppressed) {
      log("Email suppressed, skipping", { customer_email });
      return new Response(JSON.stringify({ suppressed: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generate 10 SEO page outlines via Lovable AI
    log("Generating SEO page outlines", { business_name, city, industry });

    const systemPrompt = `You are Matt Michels, a local SEO expert. Generate 10 local SEO landing page outlines for a ${industry} business named ${business_name} in ${city}. For each page: page title, target keyword, meta description (155 chars), H1, 3 key sections with 2-3 bullet points each. Format clearly with Page 1, Page 2, etc.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: systemPrompt }],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    let pagesContent = "";
    if (aiRes.ok) {
      const aiData = await aiRes.json();
      pagesContent = aiData.choices?.[0]?.message?.content || "";
    } else {
      log("AI generation failed, using placeholder", { status: aiRes.status });
      pagesContent = `10 local SEO page outlines for ${business_name} in ${city} will be provided shortly. Please contact Matt at matt@m2training.com if you don't receive your pages within 24 hours.`;
    }

    // Format pages as HTML sections
    const pagesSections = pagesContent
      .split(/Page \d+/i)
      .filter((s) => s.trim().length > 0)
      .map((section, i) => {
        const lines = section.trim().split("\n").filter((l) => l.trim());
        return `
          <div style="background:#f9f9f9;border-left:4px solid #f97316;padding:20px 24px;margin-bottom:24px;border-radius:0 8px 8px 0;">
            <div style="font-size:13px;font-weight:900;color:#f97316;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Page ${i + 1}</div>
            ${lines.map((line) => {
              const trimmed = line.trim();
              if (trimmed.startsWith("•") || trimmed.startsWith("-")) {
                return `<div style="font-size:13px;color:#555;padding:2px 0 2px 16px;">• ${trimmed.replace(/^[•\-]\s*/, "")}</div>`;
              }
              if (trimmed.includes(":")) {
                const [label, ...rest] = trimmed.split(":");
                return `<div style="font-size:13px;color:#333;padding:4px 0;"><strong>${label}:</strong>${rest.join(":")}</div>`;
              }
              return `<div style="font-size:13px;color:#333;padding:2px 0;">${trimmed}</div>`;
            }).join("")}
          </div>`;
      })
      .join("");

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;">
<tr><td align="center" style="padding:32px 16px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#fff;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
    <tr><td style="background:#1a1a2e;padding:28px 32px;">
      <div style="font-size:22px;font-weight:900;color:#f97316;letter-spacing:2px;">MATT MICHELS</div>
      <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:4px;margin-top:2px;">LOCAL SEO · WEB DESIGN</div>
    </td></tr>
    <tr><td style="padding:32px;">
      <h2 style="color:#1a1a2e;font-size:20px;font-weight:900;margin:0 0 8px;">Your 10 Local SEO Pages</h2>
      <p style="color:#555;font-size:14px;margin:0 0 24px;line-height:1.6;">
        Hi there — here are your 10 local SEO landing page outlines for <strong>${business_name}</strong> in <strong>${city}</strong>.
        Each page is built around a specific local keyword to help you rank on Google when customers in your area search for ${industry} services.
      </p>
      <hr style="border:none;border-top:2px solid #f97316;margin:0 0 28px;">
      ${pagesSections || `<p style="color:#555;font-size:14px;">${pagesContent}</p>`}
      <hr style="border:none;border-top:1px solid #eee;margin:28px 0;">
      <p style="color:#555;font-size:13px;line-height:1.7;margin:0 0 8px;">
        <strong>Next steps:</strong> Add these pages to your website. Each page should be its own URL (e.g. /your-city-${industry.toLowerCase().replace(/\s+/g, "-")}).
        Use the keyword as the page's primary focus throughout the content.
      </p>
      <p style="color:#555;font-size:13px;line-height:1.7;margin:0;">
        Questions? Reply to this email or reach me at <a href="mailto:matt@m2training.com" style="color:#f97316;">matt@m2training.com</a>.
      </p>
    </td></tr>
    <tr><td style="background:#1a1a2e;padding:20px 32px;text-align:center;">
      <p style="color:#888;font-size:11px;margin:0;">Matt Michels · Web Design &amp; Local SEO · Grosse Pointe, MI</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

    // Send email
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Matt Michels <matt@mattmichelstraining.com>",
        to: [customer_email],
        subject: `Your 10 Local SEO Pages — ${business_name}`,
        html: emailHtml + EMAIL_SIGNATURE,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      throw new Error(`Resend error: ${err}`);
    }

    log("Email sent", { customer_email, business_name });

    // Log to email_send_log
    await supabase.from("email_send_log").insert({
      template_name: templateName,
      recipient_email: customer_email,
      sent_at: new Date().toISOString(),
    });

    // Insert to seo_package_orders
    await (supabase.from("seo_package_orders" as any) as any).insert({
      stripe_session_id,
      customer_email,
      business_name,
      city,
      industry,
      delivered_at: new Date().toISOString(),
    });

    log("SEO package delivered", { business_name, city });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    log("Error", { error: String(err) });
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
