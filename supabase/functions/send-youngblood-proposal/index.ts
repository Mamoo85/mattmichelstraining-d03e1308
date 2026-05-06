// send-youngblood-proposal
// Re-engagement proposal for Youngblood Automation — industrial automation distributor
// Subject: "Youngblood — 3 new site directions + tools that show you who's buying"
// Tailored stack: SiteRadar, Buyer Radar, Demand Radar, FieldDesk, Admin Panel
// Pricing: $499/mo (Option A) or $499 setup + $199/mo (Option B) — free add-ons 3 months

import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const TEAL = "#00d4ff";
const BLUE = "#0ea5e9";
const ORANGE = "#f97316";
const DARK = "#0a1628";
const DARK2 = "#0d1f3c";
const PANEL = "#111d2e";
const WARM = "#e2e8f0";
const MUTED = "#64748b";
const BORDER = "rgba(14,165,233,0.25)";
const GREEN = "#22c55e";

function demoFrame(opts: {
  label: string;
  tag: string;
  tagColor: string;
  headline: string;
  sub: string;
  url: string;
  isNew?: boolean;
}): string {
  return `
<a href="${opts.url}" style="display:block;text-decoration:none;margin-bottom:14px" target="_blank">
  <div style="background:${PANEL};border:1px solid ${opts.isNew ? opts.tagColor : BORDER};border-radius:12px;overflow:hidden">
    <div style="background:${DARK};padding:10px 16px;display:flex;align-items:center;gap:8px;border-bottom:1px solid ${BORDER}">
      <span style="width:9px;height:9px;border-radius:50%;background:#ef4444;display:inline-block"></span>
      <span style="width:9px;height:9px;border-radius:50%;background:#f59e0b;display:inline-block"></span>
      <span style="width:9px;height:9px;border-radius:50%;background:#22c55e;display:inline-block"></span>
      <span style="background:#050d1a;color:#475569;font-size:11px;padding:3px 10px;border-radius:4px;font-family:monospace;flex:1;margin-left:6px">${opts.url.replace("https://", "")}</span>
      ${opts.isNew ? `<span style="background:${opts.tagColor};color:#fff;font-size:9px;font-weight:800;letter-spacing:1px;padding:2px 8px;border-radius:100px;text-transform:uppercase">NEW</span>` : ""}
    </div>
    <div style="padding:20px 22px">
      <div style="display:inline-block;background:${opts.tagColor}22;color:${opts.tagColor};font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:3px 10px;border-radius:100px;margin-bottom:10px">${opts.tag}</div>
      <div style="color:#e2e8f0;font-size:16px;font-weight:800;line-height:1.3;margin-bottom:6px">${opts.headline}</div>
      <div style="color:${MUTED};font-size:13px;line-height:1.5">${opts.sub}</div>
      <div style="margin-top:14px;color:${opts.tagColor};font-size:12px;font-weight:700">Click to view live demo →</div>
    </div>
  </div>
</a>`;
}

function addonBadge(name: string, value: string, free: boolean): string {
  return `
<div style="background:${PANEL};border:1px solid ${free ? GREEN + "44" : BORDER};border-radius:10px;padding:14px 16px;margin-bottom:10px">
  <div style="display:flex;justify-content:space-between;align-items:center">
    <div style="color:#e2e8f0;font-size:14px;font-weight:700">${name}</div>
    <div style="${free ? `background:${GREEN}22;color:${GREEN}` : `color:${MUTED}`};font-size:11px;font-weight:700;padding:2px 10px;border-radius:100px">${free ? "FREE – 3 months" : value}</div>
  </div>
</div>`;
}

function buildEmail(name: string): string {
  const n = name || "there";
  const yesALink = `mailto:matt@detroitwebagent.com?subject=Youngblood%20%E2%80%94%20YES%20Option%20A%20%E2%80%94%20%24499%2Fmo&body=Matt%20%E2%80%94%20let%27s%20go%20with%20Option%20A.%20%24499%2Fmo%20all-in.%0A%0APreferred%20start%20date%3A%20%0ADemo%20I%20prefer%3A%20`;
  const yesBLink = `mailto:matt@detroitwebagent.com?subject=Youngblood%20%E2%80%94%20YES%20Option%20B%20%E2%80%94%20%24499%20setup%20%2B%20%24199%2Fmo&body=Matt%20%E2%80%94%20let%27s%20go%20with%20Option%20B.%20%24499%20setup%20%2B%20%24199%2Fmo.%0A%0APreferred%20start%20date%3A%20%0ADemo%20I%20prefer%3A%20`;
  const tweakLink = `mailto:matt@detroitwebagent.com?subject=Youngblood%20%E2%80%94%20I%20want%20tweaks%20to%20the%20demo&body=Matt%20%E2%80%94%20I%27m%20interested.%20I%20like%20Demo%20%5BX%5D%20but%20want%20to%20tweak%3A%0A%0A`;

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:${DARK};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:640px;margin:0 auto;background:${DARK}">

  <!-- Header -->
  <div style="padding:28px 32px 20px;text-align:center;border-bottom:2px solid ${TEAL}">
    <div style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:3px">DETROIT <span style="color:${TEAL}">WEB AGENCY</span></div>
    <div style="color:${TEAL};font-size:10px;letter-spacing:4px;margin-top:5px;font-weight:600">WE HANDLE THE TECH. YOU CLOSE THE DEALS.</div>
  </div>

  <!-- Body -->
  <div style="padding:32px;color:${WARM};font-size:15px;line-height:1.7">

    <!-- Greeting -->
    <p style="font-size:22px;font-weight:800;color:#ffffff;margin:0 0 6px;line-height:1.25">${n} — a lot has changed since we last reached out.</p>
    <p style="color:#94a3b8;margin:0 0 24px;font-size:15px;line-height:1.6">We've added tools that are genuinely built for industrial B2B — the kind where one deal is worth $40,000 and the difference between winning it and losing it is whether you knew that Stellantis procurement was on your website last Tuesday. We've also dropped our price significantly. Here's the full picture.</p>

    <!-- Divider -->
    <div style="height:1px;background:${BORDER};margin:28px 0"></div>

    <!-- Demos -->
    <p style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 18px">Three Site Directions — Click Any to See Live</p>

    ${demoFrame({
      label: "Demo A",
      tag: "Dark · Industrial",
      tagColor: BLUE,
      headline: "Youngblood Automation — Detroit's Industrial Automation Experts",
      sub: "Deep navy, blue accents. Authoritative and technical. Built to signal 'we are the industrial experts' — the way Boeing's or Parker Hannifin's site feels.",
      url: "https://detroitwebagent.com/demo-youngblood",
    })}

    ${demoFrame({
      label: "Demo B",
      tag: "Steel & Fire",
      tagColor: ORANGE,
      headline: "Youngblood Automation — Precision. Power. Detroit.",
      sub: "White background, red/orange accents. Energy and urgency. Reads like a company that moves fast and wins contracts. High contrast, easy to scan.",
      url: "https://detroitwebagent.com/demo-youngblood-alt1",
    })}

    ${demoFrame({
      label: "Demo C",
      tag: "Precision Grid · Cyber",
      tagColor: "#a78bfa",
      headline: "Youngblood Automation — Industrial Intelligence Platform",
      sub: "Dark, high-tech grid aesthetic. Makes automation feel like a competitive edge, not a commodity. Designed to win enterprise procurement trust on sight.",
      url: "https://detroitwebagent.com/demo-youngblood-alt2",
      isNew: true,
    })}

    <p style="color:${MUTED};font-size:13px;font-style:italic;margin:8px 0 0">None of these exactly right? Tell me which direction is closest. We'll build two more until it's perfect.</p>

    <!-- Divider -->
    <div style="height:1px;background:${BORDER};margin:28px 0"></div>

    <!-- The intelligence pitch -->
    <p style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 14px">Why B2B Industrial Sites Are Different</p>

    <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 16px">Your buyers don't fill out contact forms. They visit your site six times, compare you with three competitors, read your case studies, then call whoever showed up first in their research. You have no idea this is happening right now.</p>

    <div style="background:${PANEL};border-left:3px solid ${TEAL};border-radius:0 10px 10px 0;padding:18px 22px;margin:0 0 14px">
      <div style="font-size:32px;font-weight:900;color:${TEAL};letter-spacing:-2px;line-height:1">Real-time</div>
      <div style="font-size:14px;font-weight:700;color:#e2e8f0;margin-top:4px">company-level visitor alerts via SiteRadar</div>
      <div style="font-size:13px;color:${MUTED};margin-top:3px">When a Ford, Stellantis, or Lear Corporation procurement contact lands on your hydraulics or automation pages, you get a text. Company name, pages visited, time on site. Call them before they call your competitor.</div>
    </div>

    <div style="background:${PANEL};border-left:3px solid ${ORANGE};border-radius:0 10px 10px 0;padding:18px 22px;margin:0 0 14px">
      <div style="font-size:32px;font-weight:900;color:${ORANGE};letter-spacing:-2px;line-height:1">Daily</div>
      <div style="font-size:14px;font-weight:700;color:#e2e8f0;margin-top:4px">procurement signal monitoring via Buyer Radar</div>
      <div style="font-size:13px;color:${MUTED};margin-top:3px">Buyer Radar scans MITN.info, SAM.gov, and 40+ procurement databases every morning. When a company you sell to posts an RFP or purchasing signal, you're notified before most of your competitors even know it exists.</div>
    </div>

    <div style="background:${PANEL};border-left:3px solid #a78bfa;border-radius:0 10px 10px 0;padding:18px 22px;margin:0 0 28px">
      <div style="font-size:32px;font-weight:900;color:#a78bfa;letter-spacing:-2px;line-height:1">Weekly</div>
      <div style="font-size:14px;font-weight:700;color:#e2e8f0;margin-top:4px">market intelligence via Demand Radar</div>
      <div style="font-size:13px;color:${MUTED};margin-top:3px">Every Monday you get a brief on what's moving in your sector — construction starts, plant expansions, new facility permits, federal contract awards to your customers. The kind of intel that used to require an industry consultant.</div>
    </div>

    <!-- Divider -->
    <div style="height:1px;background:${BORDER};margin:28px 0"></div>

    <!-- What's included -->
    <p style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 16px">What You Get (Both Options, All Included)</p>

    <ul style="margin:0 0 20px;padding:0 0 0 20px;color:${WARM};font-size:14px;line-height:2.0">
      <li><strong style="color:${TEAL}">New website on your domain</strong> — your brand, your products, fast, mobile-perfect, built to rank for "automation distributor Detroit" and related terms.</li>
      <li><strong style="color:${TEAL}">Owner Admin Panel</strong> — you or your team logs into <code style="background:#0d1f3c;padding:1px 5px;border-radius:3px">/admin</code> and edits products, case studies, and team pages yourself. No agency back-and-forth.</li>
      <li><strong style="color:${TEAL}">SiteRadar — Company-Level Visitor Intelligence</strong> — real-time text alert the moment a target company hits your site. Company name, pages viewed, time spent. No other tool does this for B2B industrial.</li>
      <li><strong style="color:${TEAL}">Buyer Radar — Procurement Signal Monitor</strong> — daily scan of 40+ public procurement sources. Active RFPs from your target accounts surface in your inbox before your competitors see them.</li>
      <li><strong style="color:${TEAL}">Demand Radar — Weekly Market Intel</strong> — Monday brief on sector movements: facility expansions, new plant starts, federal awards to your customers, competitor shifts.</li>
      <li><strong style="color:${TEAL}">FieldDesk CRM</strong> — if your team does on-site installs or service calls, FieldDesk dispatches jobs, tracks technician location, and sends automated follow-up texts after every visit.</li>
      <li><strong style="color:${TEAL}">Forever Pricing</strong> — your price never goes up. Every feature we add (daily) is yours free, indefinitely.</li>
    </ul>

    <!-- Add-ons free 3 months -->
    <div style="background:${DARK2};border:2px solid ${GREEN}44;border-radius:12px;padding:20px 22px;margin:0 0 28px">
      <p style="color:${GREEN};font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;margin:0 0 14px">FREE FOR YOUR FIRST 3 MONTHS — THEN INCLUDED</p>
      ${addonBadge("SiteRadar — Company Visitor Intelligence ($49/mo value)", "$49/mo", true)}
      ${addonBadge("Buyer Radar — Procurement Signal Monitor ($149/mo value)", "$149/mo", true)}
      ${addonBadge("Demand Radar — Weekly Market Intel ($99/mo value)", "$99/mo", true)}
      ${addonBadge("FieldDesk CRM — Job Dispatch & Follow-Up ($199/mo value)", "$199/mo", true)}
      ${addonBadge("Owner Admin Panel — edit your site yourself", "included", true)}
      <p style="color:${MUTED};font-size:12px;margin:12px 0 0;font-style:italic">All tools run automatically. No IT setup. No new software for your sales team to learn.</p>
    </div>

    <!-- Pricing -->
    <div style="height:1px;background:${BORDER};margin:28px 0"></div>
    <p style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 14px">Two Ways to Get Started</p>

    <div style="background:${PANEL};border:2px solid ${TEAL};border-radius:12px;padding:22px;margin:0 0 14px">
      <div style="display:inline-block;background:${TEAL};color:${DARK};font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:4px 12px;border-radius:100px;margin-bottom:12px">Most Popular</div>
      <div style="color:#ffffff;font-size:18px;font-weight:900;margin-bottom:8px">Option A — $499/mo · Zero Upfront</div>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0">All-in. New website, all intelligence tools, admin panel, 3 months of free add-ons, forever pricing. Cancel anytime. We start the moment you say yes.</p>
    </div>

    <div style="background:${PANEL};border:1px solid ${BORDER};border-radius:12px;padding:22px;margin:0 0 28px">
      <div style="color:#ffffff;font-size:18px;font-weight:900;margin-bottom:8px">Option B — $499 Setup · $199/mo After</div>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0">One-time build fee, then $199/mo. Lower recurring cost. Same website, same tools, same forever pricing. Good if you prefer a lower monthly number after the first month.</p>
    </div>

    <!-- CTA -->
    <div style="background:linear-gradient(135deg,${TEAL} 0%,#0099cc 100%);border-radius:12px;padding:28px;margin:0 0 24px;text-align:center">
      <p style="color:${DARK};font-weight:900;font-size:20px;margin:0 0 8px;line-height:1.3">Ready to see who's already visiting your site?</p>
      <p style="color:${DARK};font-size:14px;margin:0 0 20px;font-weight:600">Just click one of the buttons below. I'll handle everything from there.</p>
      <div style="display:flex;flex-direction:column;gap:10px;max-width:380px;margin:0 auto">
        <a href="${yesALink}" style="background:${DARK};color:${TEAL};text-decoration:none;font-weight:800;font-size:14px;padding:14px 20px;border-radius:8px;display:block;text-align:center;letter-spacing:0.5px">YES — Option A ($499/mo all-in) →</a>
        <a href="${yesBLink}" style="background:${DARK};color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:14px 20px;border-radius:8px;display:block;text-align:center;letter-spacing:0.5px">YES — Option B ($499 setup + $199/mo) →</a>
        <a href="${tweakLink}" style="background:transparent;color:${DARK};border:2px solid ${DARK}40;text-decoration:none;font-weight:700;font-size:13px;padding:12px 20px;border-radius:8px;display:block;text-align:center">I like a demo but want to make tweaks first →</a>
      </div>
    </div>

    <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0 0 6px">Or just call or text me direct: <a href="tel:+13139921219" style="color:${TEAL};font-weight:700;text-decoration:none">(313) 992-1219</a></p>
    <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0 0 24px">I'll answer. You'll get a human, not a ticket queue.</p>

    <!-- Sign-off -->
    <div style="border-top:1px solid #1e3a5f;padding-top:20px">
      <p style="color:${WARM};font-size:14px;margin:0">— Matt Michels</p>
      <p style="color:${MUTED};font-size:12px;margin:5px 0 0">Detroit Web Agency &nbsp;·&nbsp; (313) 992-1219 &nbsp;·&nbsp; <a href="mailto:matt@detroitwebagent.com" style="color:${TEAL};text-decoration:none">matt@detroitwebagent.com</a></p>
      <p style="color:${MUTED};font-size:11px;margin:18px 0 0;font-style:italic">P.S. SiteRadar starts sending you company-level visitor alerts the day we launch. The first time you get a text that says "Stellantis — visited your hydraulics page 3 times in the last 2 days" — that's the moment the product pays for itself. That text is literally free money if you make the call.</p>
    </div>

  </div>

  <!-- Footer -->
  <div style="padding:20px 32px;border-top:1px solid #1e3a5f;text-align:center">
    <p style="margin:0;color:#4a6fa5;font-size:12px">Detroit Web Agency · Grosse Pointe Park, MI · (313) 992-1219</p>
    <p style="margin:6px 0 0;font-size:11px"><a href="https://detroitwebagent.com" style="color:${TEAL};text-decoration:none">detroitwebagent.com</a></p>
  </div>

</div></body></html>`;
}

function buildPlainText(name: string): string {
  const n = name || "there";
  return `${n} — a lot has changed since we last reached out.

We've added tools genuinely built for industrial B2B — the kind where one deal is worth $40,000 and the difference is whether you knew Stellantis procurement was on your website last Tuesday. We've also dropped our price significantly.

── THREE SITE DIRECTIONS ──

→ Demo A (Dark / Industrial): https://detroitwebagent.com/demo-youngblood
→ Demo B (Steel & Fire): https://detroitwebagent.com/demo-youngblood-alt1
→ Demo C (Precision Grid / Cyber): https://detroitwebagent.com/demo-youngblood-alt2

None exactly right? Tell me which direction is closest. We'll build two more.

── WHY B2B INDUSTRIAL SITES ARE DIFFERENT ──

SiteRadar — Real-time company-level visitor alerts
When Ford, Stellantis, or Lear Corporation procurement lands on your site, you get a text. Company name, pages visited, time on site. Call them before they call your competitor.

Buyer Radar — Daily procurement signal monitoring
Scans MITN.info, SAM.gov, and 40+ procurement databases every morning. Active RFPs from your target accounts in your inbox before your competitors know they exist.

Demand Radar — Weekly market intelligence
Monday brief on sector movements: facility expansions, new plant starts, federal awards to your customers.

── WHAT YOU GET ──

• New website on your domain — built to rank for "automation distributor Detroit"
• Owner Admin Panel — edit products, case studies, and team pages yourself at /admin
• SiteRadar — company-level visitor alerts in real-time
• Buyer Radar — daily procurement signal scan from 40+ sources
• Demand Radar — weekly market intel brief
• FieldDesk CRM — job dispatch and follow-up for field techs
• Forever Pricing — your price never goes up

── FREE FOR YOUR FIRST 3 MONTHS ──

• SiteRadar — Company Visitor Intelligence ($49/mo value)
• Buyer Radar — Procurement Signal Monitor ($149/mo value)
• Demand Radar — Weekly Market Intel ($99/mo value)
• FieldDesk CRM ($199/mo value)
• Owner Admin Panel (included)

── PRICING ──

Option A — $499/mo, zero upfront. Cancel anytime.
Option B — $499 one-time setup + $199/mo.

── GET STARTED ──

Reply YES A → Option A ($499/mo all-in)
Reply YES B → Option B ($499 setup + $199/mo)
Reply TWEAKS → Tell me which demo you like and what to change

Or call / text me direct: (313) 992-1219 — I'll answer.

— Matt Michels
Detroit Web Agency · (313) 992-1219 · matt@detroitwebagent.com

P.S. SiteRadar starts sending company-level visitor alerts the day we launch. The first time you get a text that says "Stellantis — visited your hydraulics page 3 times in the last 2 days" — that's the moment the product pays for itself.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const recipientEmail: string = String(body.recipient_email || "").trim().toLowerCase();
    const firstName: string = String(body.first_name || "there").trim();

    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return new Response(JSON.stringify({ error: "Valid recipient_email required" }), { status: 400, headers: CORS });
    }

    const html = buildEmail(firstName);
    const text = buildPlainText(firstName);

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Matt Michels — Detroit Web Agency <matt@detroitwebagent.com>",
        to: [recipientEmail],
        bcc: ["matthewmichels4@gmail.com"],
        reply_to: "matt@detroitwebagent.com",
        subject: `${firstName} — 3 new site directions + tools that show you who's buying`,
        html,
        text,
      }),
    });

    const resendBody = await resendRes.json().catch(() => ({}));
    if (!resendRes.ok) {
      console.error("[send-youngblood-proposal] Resend error", resendBody);
      return new Response(JSON.stringify({ error: "Resend send failed", detail: resendBody }), { status: 502, headers: CORS });
    }

    try {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await sb.from("notifications" as any).insert({
        type: "outreach_proposal",
        title: `Youngblood proposal sent → ${recipientEmail}`,
        body: `Re-engagement proposal (corrected $499 pricing + 3 demos + B2B intelligence stack). Resend id: ${resendBody?.id || "?"}`,
        link: "/dwa-admin",
        urgency: "fyi",
        category: "outreach",
      });
    } catch { /* non-fatal */ }

    return new Response(JSON.stringify({ sent: true, resend_id: resendBody?.id, to: recipientEmail }), { headers: CORS });
  } catch (err) {
    console.error("[send-youngblood-proposal] Error", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
