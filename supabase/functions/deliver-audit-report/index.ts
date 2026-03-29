import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY")!;

const log = (msg: string, data?: any) =>
  console.log(`[DELIVER-AUDIT-REPORT] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

async function scrapeWebsite(websiteUrl: string): Promise<string> {
  if (!websiteUrl || !FIRECRAWL_API_KEY) return "";
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: websiteUrl, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    const markdown: string = data.data?.markdown || data.markdown || "";
    return markdown.substring(0, 1000);
  } catch (err) {
    log("Firecrawl error", { error: String(err) });
    return "";
  }
}

serve(async (req: Request) => {
  try {
    const { stripe_session_id, customer_email, business_name, city, website_url } = await req.json();

    if (!stripe_session_id || !customer_email || !business_name || !city) {
      return new Response(
        JSON.stringify({ error: "Missing required fields." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const templateName = `audit_report_${stripe_session_id}`;

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

    // Scrape website if URL provided
    let scrapedContent = "";
    if (website_url) {
      log("Scraping website", { website_url });
      scrapedContent = await scrapeWebsite(website_url);
    }

    // Generate audit via Lovable AI
    log("Generating audit report", { business_name, city });

    const prompt = `You are Matt Michels, a web design expert in Metro Detroit. Write a professional website audit report for ${business_name} in ${city}. Website: ${website_url || "not provided"}. Site content preview: ${scrapedContent || "not available"}. Cover: (1) Overall grade A-F, (2) Speed & Performance assessment, (3) SEO & Local Visibility (are they targeting local keywords?), (4) Mobile Experience, (5) Conversion Rate Optimization (clear CTAs, contact info visible?), (6) Top 5 priority fixes with estimated impact. Write in first person as Matt Michels. Be specific and actionable. Under 400 words.`;

    let auditContent = "";
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 600,
        temperature: 0.7,
      }),
    });

    if (aiRes.ok) {
      const aiData = await aiRes.json();
      auditContent = aiData.choices?.[0]?.message?.content || "";
    } else {
      log("AI generation failed", { status: aiRes.status });
      auditContent = `Audit report for ${business_name} in ${city} is being finalized. Please contact matt@m2training.com if you have questions.`;
    }

    // Format audit as HTML sections
    const auditParagraphs = auditContent
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const trimmed = line.trim();
        // Section headers
        if (/^\*\*(.+)\*\*$/.test(trimmed) || /^\d+\.\s/.test(trimmed) || /^#+\s/.test(trimmed)) {
          const cleaned = trimmed.replace(/^\*\*|\*\*$/g, "").replace(/^#+\s/, "").replace(/^\d+\.\s/, "");
          return `<h3 style="color:#1a1a2e;font-size:14px;font-weight:900;margin:20px 0 6px;">${cleaned}</h3>`;
        }
        if (trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*")) {
          return `<li style="font-size:13px;color:#444;line-height:1.7;margin-bottom:4px;">${trimmed.replace(/^[•\-\*]\s*/, "")}</li>`;
        }
        return `<p style="font-size:13px;color:#444;line-height:1.7;margin:0 0 10px;">${trimmed}</p>`;
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
      <table width="100%"><tr>
        <td>
          <div style="font-size:22px;font-weight:900;color:#f97316;letter-spacing:2px;">MATT MICHELS</div>
          <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:4px;margin-top:2px;">WEB DESIGN · GROSSE POINTE, MI</div>
        </td>
        <td style="text-align:right;">
          <div style="font-size:12px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:1px;">Website Audit</div>
          <div style="font-size:10px;color:#888;margin-top:2px;">${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:32px;">
      <h2 style="color:#1a1a2e;font-size:20px;font-weight:900;margin:0 0 4px;">Your Website Audit</h2>
      <p style="color:#888;font-size:13px;margin:0 0 6px;">Prepared for: <strong style="color:#333;">${business_name}</strong> · ${city}</p>
      ${website_url ? `<p style="color:#888;font-size:12px;margin:0 0 24px;">Website: <a href="${website_url}" style="color:#f97316;">${website_url}</a></p>` : `<p style="color:#888;font-size:12px;margin:0 0 24px;">Website: Not provided — Google Business Profile reviewed</p>`}
      <hr style="border:none;border-top:2px solid #f97316;margin:0 0 24px;">
      ${auditParagraphs}
      <hr style="border:none;border-top:1px solid #eee;margin:28px 0 20px;">
      <p style="font-size:13px;color:#555;line-height:1.7;margin:0 0 8px;">
        Have questions about your audit or ready to fix these issues? I can handle everything for you.
      </p>
      <a href="mailto:matt@m2training.com" style="display:inline-block;background:#f97316;color:#fff;font-weight:700;font-size:13px;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:4px;">
        Reply to Matt →
      </a>
    </td></tr>
    <tr><td style="background:#1a1a2e;padding:20px 32px;text-align:center;">
      <p style="color:#888;font-size:11px;margin:0;">Matt Michels · Web Design &amp; Local SEO · Grosse Pointe, MI · matt@m2training.com</p>
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
        from: "Matt Michels <matt@notify.m2training.com>",
        to: [customer_email],
        subject: `Your Website Audit — ${business_name}`,
        html: emailHtml,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      throw new Error(`Resend error: ${errText}`);
    }

    log("Audit report sent", { customer_email, business_name });

    // Log to email_send_log
    await supabase.from("email_send_log").insert({
      template_name: templateName,
      recipient_email: customer_email,
      sent_at: new Date().toISOString(),
    });

    // Insert to audit_report_orders
    await (supabase.from("audit_report_orders" as any) as any).insert({
      stripe_session_id,
      customer_email,
      business_name,
      city,
      website_url: website_url || "",
      delivered_at: new Date().toISOString(),
    });

    log("Audit delivered", { business_name, city });

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
