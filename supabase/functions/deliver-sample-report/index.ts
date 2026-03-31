import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SITE = "https://www.mattmichelstraining.com";

const REPORTS: Record<string, { subject: string; heading: string; body: string; cta: string; ctaUrl: string; price: string }> = {
  trending_products: {
    subject: "Your Free Trending Product Report",
    heading: "AI Trending Product Report — Sample",
    body: `
      <h3 style="color:#e8621a;margin-bottom:4px;">Top 4 Trending Products This Week</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
        <tr style="background:#f1f5f9;"><th style="text-align:left;padding:8px;">Product</th><th style="text-align:center;padding:8px;">Trend</th><th style="text-align:center;padding:8px;">Margin</th><th style="text-align:center;padding:8px;">Score</th></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;"><strong>Portable Blender Pro</strong><br><span style="color:#94a3b8;font-size:12px;">Kitchen</span></td><td style="text-align:center;padding:8px;color:#22c55e;border-bottom:1px solid #e2e8f0;">+340%</td><td style="text-align:center;padding:8px;border-bottom:1px solid #e2e8f0;">$18.50</td><td style="text-align:center;padding:8px;border-bottom:1px solid #e2e8f0;"><span style="background:#e8621a22;color:#e8621a;padding:2px 8px;border-radius:12px;font-weight:700;">94</span></td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;"><strong>LED Sunset Lamp</strong><br><span style="color:#94a3b8;font-size:12px;">Home Decor</span></td><td style="text-align:center;padding:8px;color:#22c55e;border-bottom:1px solid #e2e8f0;">+280%</td><td style="text-align:center;padding:8px;border-bottom:1px solid #e2e8f0;">$14.20</td><td style="text-align:center;padding:8px;border-bottom:1px solid #e2e8f0;"><span style="background:#e8621a22;color:#e8621a;padding:2px 8px;border-radius:12px;font-weight:700;">91</span></td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;"><strong>Magnetic Phone Mount</strong><br><span style="color:#94a3b8;font-size:12px;">Auto</span></td><td style="text-align:center;padding:8px;color:#22c55e;border-bottom:1px solid #e2e8f0;">+210%</td><td style="text-align:center;padding:8px;border-bottom:1px solid #e2e8f0;">$11.80</td><td style="text-align:center;padding:8px;border-bottom:1px solid #e2e8f0;"><span style="background:#e8621a22;color:#e8621a;padding:2px 8px;border-radius:12px;font-weight:700;">88</span></td></tr>
        <tr><td style="padding:8px;"><strong>Scalp Massager 2.0</strong><br><span style="color:#94a3b8;font-size:12px;">Beauty</span></td><td style="text-align:center;padding:8px;color:#22c55e;">+195%</td><td style="text-align:center;padding:8px;">$9.40</td><td style="text-align:center;padding:8px;"><span style="background:#e8621a22;color:#e8621a;padding:2px 8px;border-radius:12px;font-weight:700;">85</span></td></tr>
      </table>
      <p style="color:#94a3b8;font-size:13px;text-align:center;margin:16px 0;">The full report includes 20+ products with sourcing links, competition analysis, and ad copy suggestions.</p>
    `,
    cta: "Unlock Full Reports - $29/mo",
    ctaUrl: `${SITE}/get-started?service=trending_products`,
    price: "$29/mo",
  },
  grant_digest: {
    subject: "Your Free Grant & Funding Report",
    heading: "AI Grant & Funding Digest - Sample",
    body: `
      <h3 style="color:#e8621a;margin-bottom:4px;">Top 3 Grant Matches</h3>
      <div style="margin:16px 0;">
        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;"><strong>SBA Community Advantage Loan</strong><span style="color:#e8621a;font-weight:700;">$50K-$250K</span></div>
          <p style="color:#94a3b8;font-size:13px;margin:4px 0;">Federal - Rolling deadline - <span style="color:#22c55e;font-weight:700;">92% match</span></p>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;"><strong>USDA Rural Business Grant</strong><span style="color:#e8621a;font-weight:700;">$10K-$500K</span></div>
          <p style="color:#94a3b8;font-size:13px;margin:4px 0;">Federal - Mar 31 deadline - <span style="color:#22c55e;font-weight:700;">88% match</span></p>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
          <div style="display:flex;justify-content:space-between;"><strong>State MEDC Small Biz Grant</strong><span style="color:#e8621a;font-weight:700;">$5K-$50K</span></div>
          <p style="color:#94a3b8;font-size:13px;margin:4px 0;">State - Apr 15 deadline - <span style="color:#22c55e;font-weight:700;">85% match</span></p>
        </div>
      </div>
      <p style="color:#94a3b8;font-size:13px;text-align:center;">Full digest includes 15+ matched opportunities with application links and eligibility details.</p>
    `,
    cta: "Unlock Full Digest - $29/mo",
    ctaUrl: `${SITE}/get-started?service=grant_digest`,
    price: "$29/mo",
  },
  real_estate_digest: {
    subject: "Your Free Real Estate Market Report",
    heading: "AI Real Estate Market Digest - Sample",
    body: `
      <h3 style="color:#e8621a;margin-bottom:4px;">Top 3 Market Snapshots</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
        <tr style="background:#f1f5f9;"><th style="text-align:left;padding:8px;">Market</th><th style="text-align:center;padding:8px;">Median</th><th style="text-align:center;padding:8px;">YoY</th><th style="text-align:center;padding:8px;">Score</th></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;"><strong>Austin, TX</strong></td><td style="text-align:center;padding:8px;border-bottom:1px solid #e2e8f0;">$485,000</td><td style="text-align:center;padding:8px;color:#22c55e;border-bottom:1px solid #e2e8f0;">+4.2%</td><td style="text-align:center;padding:8px;border-bottom:1px solid #e2e8f0;"><span style="background:#ef444422;color:#ef4444;padding:2px 8px;border-radius:12px;font-weight:700;">95</span></td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;"><strong>Nashville, TN</strong></td><td style="text-align:center;padding:8px;border-bottom:1px solid #e2e8f0;">$420,000</td><td style="text-align:center;padding:8px;color:#22c55e;border-bottom:1px solid #e2e8f0;">+3.8%</td><td style="text-align:center;padding:8px;border-bottom:1px solid #e2e8f0;"><span style="background:#f59e0b22;color:#f59e0b;padding:2px 8px;border-radius:12px;font-weight:700;">91</span></td></tr>
        <tr><td style="padding:8px;"><strong>Boise, ID</strong></td><td style="text-align:center;padding:8px;">$395,000</td><td style="text-align:center;padding:8px;color:#ef4444;">-1.2%</td><td style="text-align:center;padding:8px;"><span style="background:#3b82f622;color:#3b82f6;padding:2px 8px;border-radius:12px;font-weight:700;">72</span></td></tr>
      </table>
      <p style="color:#94a3b8;font-size:13px;text-align:center;">Full digest includes 15+ markets with rental yield, days-on-market, and AI investment recommendations.</p>
    `,
    cta: "Unlock Full Digest - $39/mo",
    ctaUrl: `${SITE}/get-started?service=real_estate_digest`,
    price: "$39/mo",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, name, report_type, industry, market } = await req.json();
    if (!email || !report_type) {
      return new Response(JSON.stringify({ error: "email and report_type required" }), { status: 400, headers: corsHeaders });
    }

    const report = REPORTS[report_type];
    if (!report) {
      return new Response(JSON.stringify({ error: "Unknown report type" }), { status: 400, headers: corsHeaders });
    }

    const firstName = name ? name.split(" ")[0] : "";
    const greeting = firstName ? `Hey ${firstName}` : "Hey there";

    const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;padding:32px;margin:0;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
  <div style="background:#e8621a;height:4px;"></div>
  <div style="padding:28px 32px;color:#1e293b;font-size:15px;line-height:1.8;">
    <p>${greeting} --</p>
    <p>Here is your free sample report. This is a preview of what our subscribers get every week.</p>
    
    <div style="background:#f8fafc;border-radius:10px;padding:20px;margin:20px 0;border:1px solid #e2e8f0;">
      <h2 style="color:#1e293b;font-size:18px;margin:0 0 12px;">${report.heading}</h2>
      ${report.body}
    </div>

    <div style="text-align:center;margin:28px 0;">
      <a href="${report.ctaUrl}" style="background:#e8621a;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">${report.cta}</a>
      <p style="color:#94a3b8;font-size:12px;margin-top:8px;">Cancel anytime. No contracts.</p>
    </div>

    <p style="font-size:14px;color:#64748b;">Questions? Just reply to this email or text me at <a href="tel:+13138064952" style="color:#e8621a;">(313) 806-4952</a>.</p>
    
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;">
      <img src="${SITE}/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
      <div style="font-size:13px;color:#64748b;">
        <strong style="color:#1e293b;">Matt Michels</strong><br/>M2 Development -- Grosse Pointe, MI
      </div>
      <img src="${SITE}/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
    </div>
  </div>
</div>
</body></html>`;

    if (!RESEND_API_KEY) {
      console.error("[DELIVER-SAMPLE-REPORT] RESEND_API_KEY not set");
      return new Response(JSON.stringify({ error: "Email service not configured" }), { status: 500, headers: corsHeaders });
    }

    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Matt Michels <matt@notify.m2training.com>",
        to: [email],
        subject: report.subject,
        html,
      }),
    });

    if (!sendRes.ok) {
      const errBody = await sendRes.text();
      console.error("[DELIVER-SAMPLE-REPORT] Resend error:", errBody);
      return new Response(JSON.stringify({ error: "Failed to send email" }), { status: 500, headers: corsHeaders });
    }

    // Notify Matt
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "M2 System <matt@notify.m2training.com>",
        to: ["matt@m2training.com"],
        subject: `Lead magnet: ${report_type} -- ${email}`,
        html: `<p><strong>${name || email}</strong> downloaded the free ${report_type.replace(/_/g, " ")} report.</p><p>Industry: ${industry || "n/a"}<br>Market: ${market || "n/a"}</p>`,
      }),
    }).catch(() => {});

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
  } catch (e: any) {
    console.error("[DELIVER-SAMPLE-REPORT] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
