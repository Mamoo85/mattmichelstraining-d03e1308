// Edge function: send-djconley-proposal
// Canonical post-meeting proposal to Pat at D.J. Conley.
// Upgraded 2026-05-05: visual previews, ROI math, verified links only, NO self-serve trial CTAs.
// Brand accents: D.J. Conley teal (#27CCC0) + red (#c12a3b), DWA teal (#00d4ff) for sender chrome.

import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// Brand
const DARK = "#0a1628";
const DWA_TEAL = "#00d4ff";
const DJC_TEAL = "#27CCC0";
const DJC_RED = "#c12a3b";
const CREAM = "#f8fafc";

// Verified, click-tested links only.
const DEMO_A_URL = "https://detroitwebagent.com/demo-djconley-v4/index.html";
const DEMO_B_URL = "https://detroitwebagent.com/demo-djconley-v2/index.html";
const HOME_URL = "https://detroitwebagent.com";
const PHONE_TEL = "tel:+13139921219";
const PHONE_LABEL = "(313) 992-1219";
const REPLY_EMAIL = "matt@detroitwebagent.com";

// ── Email-safe visual helpers (inline CSS only) ───────────────────────────────
const browserChrome = (url: string, inner: string) => `
<div style="background:#1e293b;border-radius:10px;overflow:hidden;border:1px solid #334155;margin:14px 0">
  <div style="background:#0f172a;padding:10px 14px;border-bottom:1px solid #334155">
    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ef4444;margin-right:6px"></span>
    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#eab308;margin-right:6px"></span>
    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#22c55e;margin-right:14px"></span>
    <span style="background:#0a1628;color:#94a3b8;font-size:11px;padding:4px 10px;border-radius:5px;font-family:monospace">${url}</span>
  </div>
  <div style="background:#ffffff;padding:18px">${inner}</div>
</div>`;

const smsBubble = (from: string, body: string) => `
<div style="margin:10px 0;max-width:420px">
  <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;font-weight:600">${from}</div>
  <div style="background:#1e293b;border:1px solid ${DWA_TEAL}40;color:#e2e8f0;padding:12px 16px;border-radius:18px 18px 18px 4px;font-size:13px;line-height:1.5">${body}</div>
</div>`;

const tile = (label: string, sub: string, color: string) => `
<td width="33%" style="padding:6px" align="center">
  <div style="background:#ffffff;border:1.5px solid ${color}55;border-radius:10px;padding:14px 8px;text-align:center">
    <div style="font-size:11px;font-weight:800;color:${color};letter-spacing:0.5px;text-transform:uppercase">${label}</div>
    <div style="font-size:10px;color:#64748b;margin-top:4px">${sub}</div>
  </div>
</td>`;

const dashTab = (label: string, active = false) => `
<span style="display:inline-block;padding:6px 12px;margin:2px;border-radius:6px;font-size:11px;font-weight:700;${active ? `background:${DJC_TEAL};color:#0a1628` : `background:#f1f5f9;color:#475569`}">${label}</span>`;

function dwaShell(bodyHtml: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:680px;margin:0 auto;background:${DARK}">
  <div style="padding:28px 32px 20px;text-align:center;border-bottom:2px solid ${DWA_TEAL}">
    <div style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:3px">DETROIT <span style="color:${DWA_TEAL}">WEB AGENCY</span></div>
    <div style="color:${DWA_TEAL};font-size:10px;letter-spacing:4px;margin-top:5px;font-weight:600">WE HANDLE THE TECH</div>
  </div>
  <div style="padding:32px;color:#e2e8f0;font-size:15px;line-height:1.7">${bodyHtml}</div>
  <div style="padding:20px 32px;border-top:1px solid #1e3a5f;text-align:center">
    <p style="margin:0;color:#4a6fa5;font-size:12px">Detroit Web Agency · Grosse Pointe Park, MI · ${PHONE_LABEL}</p>
    <p style="margin:6px 0 0;font-size:11px"><a href="${HOME_URL}" style="color:${DWA_TEAL};text-decoration:none">detroitwebagent.com</a></p>
  </div>
</div></body></html>`;
}

function buildBody(name: string): string {
  const n = name || "Pat";

  // Site preview
  const sitePreview = browserChrome("djconley.com", `
    <div style="text-align:center;padding:14px 8px">
      <div style="font-size:22px;font-weight:900;color:${DJC_TEAL};letter-spacing:1px">D.J. CONLEY <span style="color:${DJC_RED}">ASSOCIATES</span></div>
      <div style="font-size:11px;color:#64748b;letter-spacing:2px;margin:6px 0 16px;text-transform:uppercase">Industrial Boiler Systems · SE Michigan · Since 1957</div>
      <div style="display:inline-block;background:${DJC_RED};color:#fff;padding:10px 22px;border-radius:6px;font-size:13px;font-weight:800;margin:0 4px">REQUEST SERVICE</div>
      <div style="display:inline-block;background:#fff;color:${DJC_TEAL};border:2px solid ${DJC_TEAL};padding:8px 20px;border-radius:6px;font-size:13px;font-weight:800;margin:0 4px">${PHONE_LABEL}</div>
      <div style="margin-top:14px;font-size:10px;color:#94a3b8">Mobile-perfect · Built in your real teal + red palette · Live demo links below</div>
    </div>
  `);

  // Owner Dashboard preview
  const dashboardMock = browserChrome("djconley.com/admin", `
    <div style="border-bottom:2px solid ${DJC_TEAL};padding-bottom:8px;margin-bottom:10px">
      <div style="font-size:14px;font-weight:900;color:${DJC_TEAL}">D.J. CONLEY <span style="color:${DJC_RED}">DASHBOARD</span></div>
    </div>
    <div style="margin-bottom:12px">
      ${dashTab("Dashboard", true)}${dashTab("Command Center")}${dashTab("Visitor Intel")}${dashTab("Predictive Sales")}${dashTab("Email Campaigns")}${dashTab("Reviews")}${dashTab("Jobs (eWay)")}${dashTab("Content")}${dashTab("Settings")}
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px">
      <tr>
        <td width="33%" style="padding:4px"><div style="background:${CREAM};border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:900;color:${DJC_TEAL}">37</div><div style="font-size:10px;color:#64748b;font-weight:600">VISITORS TODAY</div></div></td>
        <td width="33%" style="padding:4px"><div style="background:${CREAM};border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:900;color:${DJC_RED}">4</div><div style="font-size:10px;color:#64748b;font-weight:600">HOT ACCOUNTS</div></div></td>
        <td width="33%" style="padding:4px"><div style="background:${CREAM};border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:900;color:${DJC_TEAL}">$184k</div><div style="font-size:10px;color:#64748b;font-weight:600">EST. PIPELINE</div></div></td>
      </tr>
    </table>
    <div style="margin-top:10px;background:#f8fafc;border-left:3px solid ${DJC_RED};padding:8px 10px;font-size:11px;color:#334155"><strong>What's New:</strong> Fusion v2 shipped this week — free, as promised.</div>
  `);

  // Command Center tile grid
  const commandCenterMock = browserChrome("djconley.com/admin/command-center", `
    <div style="font-size:13px;font-weight:800;color:${DJC_TEAL};margin-bottom:8px">Your Command Center — every tab, one click</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>${tile("eWay", "CRM", DJC_TEAL)}${tile("FieldServio", "ERP", DJC_TEAL)}${tile("QuickBooks", "Accounting", DJC_TEAL)}</tr>
      <tr>${tile("Gmail", "Inbox", DJC_RED)}${tile("Calendar", "Schedule", DJC_RED)}${tile("BSEED", "Permits", DJC_RED)}</tr>
      <tr>${tile("MITN.info", "RFPs", DJC_TEAL)}${tile("Bank", "Cash", DJC_TEAL)}${tile("+ Add Tile", "anything", "#94a3b8")}</tr>
    </table>
    <div style="margin-top:10px;font-size:11px;color:#475569;text-align:center"><em>Drag to reorder. SSO where supported. Reply with the full list of tabs you bounce between and I'll wire them all in before launch.</em></div>
  `);

  // FieldDesk parallel mock
  const fieldDeskMock = browserChrome("djconley.com/admin → FieldDesk (running next to eWay)", `
    <div style="font-size:13px;font-weight:800;color:${DJC_TEAL};margin-bottom:8px">Today's Crew — Live</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="33%" style="padding:4px;vertical-align:top"><div style="background:#fef3c7;border-radius:6px;padding:8px;font-size:11px"><strong style="color:#92400e">EN ROUTE</strong><br/><span style="color:#475569">Mike → Henry Ford Hospital</span><br/><span style="color:#94a3b8;font-size:10px">ETA 14 min</span></div></td>
        <td width="33%" style="padding:4px;vertical-align:top"><div style="background:#dbeafe;border-radius:6px;padding:8px;font-size:11px"><strong style="color:${DJC_TEAL}">ON SITE</strong><br/><span style="color:#475569">Tony → Stellantis Warren</span><br/><span style="color:#94a3b8;font-size:10px">Boiler #3 tune-up</span></div></td>
        <td width="33%" style="padding:4px;vertical-align:top"><div style="background:#dcfce7;border-radius:6px;padding:8px;font-size:11px"><strong style="color:#166534">COMPLETE</strong><br/><span style="color:#475569">Dave → Beaumont Royal Oak</span><br/><span style="color:#94a3b8;font-size:10px">Photos + invoice sent</span></div></td>
      </tr>
    </table>
    <div style="margin-top:10px;background:${CREAM};border-radius:6px;padding:8px;font-size:11px;color:#334155"><strong>Auto-text just sent to customer:</strong> "Tony from D.J. Conley is on site at your boiler now."</div>
  `);

  // SiteRadar SMS (honest framing)
  const siteRadarMock = `
<div style="background:#0d1f3c;border:1px solid ${DWA_TEAL}40;border-radius:14px;padding:16px;margin:14px 0">
  <div style="font-size:11px;color:${DWA_TEAL};font-weight:700;letter-spacing:1px;margin-bottom:8px">📱 INCOMING SMS — ${PHONE_LABEL} → Pat</div>
  ${smsBubble("SiteRadar · just now", `<strong>Stellantis</strong> just visited your <em>/boiler-tune-up</em> page (4 min, 3 pages).<br/><br/>Likely contact at this org: <strong>Mark Reuss</strong>, VP Facilities — (313) 555-0142, mark.r@stellantis.com<br/><span style="font-size:11px;color:#94a3b8">(Apollo-enriched org contact, not the actual visitor — RB2B opt-in for true person-level ID)</span>`)}
</div>`;

  // Fusion alert
  const fusionMock = `
<div style="background:linear-gradient(135deg,#0d1f3c 0%,#13294b 100%);border:2px solid ${DJC_RED};border-radius:14px;padding:18px;margin:14px 0">
  <div style="font-size:11px;color:${DJC_RED};font-weight:800;letter-spacing:1.5px;margin-bottom:10px">⚡ FUSION ALERT — THE WEDGE</div>
  ${smsBubble("Predictive Sales · 9:14am", `🔥 <strong>Stellantis</strong> just hit your site AND has an active <strong>$2.4M boiler RFP on MITN.info</strong> (closes in 11 days).<br/><br/>This is the call to make today. Likely contact: Mark Reuss, VP Facilities. Want me to draft the outreach?`)}
  <div style="font-size:11px;color:#94a3b8;margin-top:8px;text-align:center"><em>One SMS. Both signals tied together. No competitor can do this.</em></div>
</div>`;

  // Email blast engine
  const emailBlastMock = browserChrome("djconley.com/admin → Email Campaigns", `
    <div style="font-size:13px;font-weight:800;color:${DJC_TEAL};margin-bottom:10px">Email Blast Engine</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>${tile("Manual Blast", "send now", DJC_TEAL)}${tile("Recurring", "seasonal", DJC_TEAL)}${tile("Trigger", "6 mo since job", DJC_TEAL)}</tr>
    </table>
    <div style="margin-top:12px;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px;font-size:12px;color:#991b1b;text-align:center">
      <strong>MASTER KILL SWITCH:</strong> ON ●━━━━━━━ <em>(one tap = all sending stops)</em>
    </div>
  `);

  // SMS / reviews / missed-call
  const smsCenterMock = `
<div style="background:#0d1f3c;border:1px solid ${DWA_TEAL}40;border-radius:14px;padding:16px;margin:14px 0">
  <div style="font-size:11px;color:${DWA_TEAL};font-weight:700;letter-spacing:1px;margin-bottom:8px">📱 SMS CENTER — auto-firing</div>
  ${smsBubble("To customer · after job", `Thanks for choosing D.J. Conley! Quick favor — would you leave us a Google review? <a href="${HOME_URL}" style="color:${DWA_TEAL}">tap here</a>`)}
  ${smsBubble("To missed caller · 38s after hangup", `Hey, sorry we missed you — this is D.J. Conley. What can we help with? Reply here and a real person will answer.`)}
</div>`;

  // ROI math
  const roiBlock = `
<div style="background:#0d1f3c;border:1px solid ${DWA_TEAL}40;border-radius:12px;padding:20px;margin:16px 0">
  <p style="color:${DWA_TEAL};font-weight:800;font-size:12px;margin:0 0 14px;letter-spacing:1.5px;text-transform:uppercase">📊 The Math — Conservative</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#e2e8f0">
    <tr><td style="padding:6px 0;border-bottom:1px solid #1e3a5f"><strong style="color:#fff">1 recovered missed-call boiler service</strong> at avg $1,800 ticket</td><td align="right" style="padding:6px 0;border-bottom:1px solid #1e3a5f;color:${DJC_TEAL};font-weight:700">+ $1,800</td></tr>
    <tr><td style="padding:6px 0;border-bottom:1px solid #1e3a5f"><strong style="color:#fff">1 review-driven new customer</strong> from automated review push (avg LTV $4,500)</td><td align="right" style="padding:6px 0;border-bottom:1px solid #1e3a5f;color:${DJC_TEAL};font-weight:700">+ $4,500</td></tr>
    <tr><td style="padding:6px 0;border-bottom:1px solid #1e3a5f"><strong style="color:#fff">1 SiteRadar/Fusion win</strong> on a mid-six-figure facility account (1% close rate on $200k RFP visibility)</td><td align="right" style="padding:6px 0;border-bottom:1px solid #1e3a5f;color:${DJC_TEAL};font-weight:700">+ $2,000</td></tr>
    <tr><td style="padding:6px 0;border-bottom:1px solid #1e3a5f"><strong style="color:#fff">1 seasonal email-blast service call</strong> recovered (boiler tune-up reminder, avg $850)</td><td align="right" style="padding:6px 0;border-bottom:1px solid #1e3a5f;color:${DJC_TEAL};font-weight:700">+ $850</td></tr>
    <tr><td style="padding:10px 0 4px"><strong style="color:#fff">Conservative monthly upside</strong></td><td align="right" style="padding:10px 0 4px;color:#fff;font-weight:900;font-size:16px">$9,150</td></tr>
    <tr><td style="padding:0 0 4px;font-size:11px;color:#94a3b8">Cost of full stack (Option A)</td><td align="right" style="padding:0 0 4px;color:#94a3b8;font-size:11px">– $499</td></tr>
    <tr><td style="padding:0;font-size:13px;color:${DJC_TEAL};font-weight:800">Net month one</td><td align="right" style="padding:0;font-size:18px;color:${DJC_TEAL};font-weight:900">≈ $8,651</td></tr>
  </table>
  <p style="font-size:11px;color:#94a3b8;margin:12px 0 0;line-height:1.5"><em>None of these numbers require a heroic close. They assume one win per category per month — every category is independent of the others. Most months will be larger.</em></p>
</div>`;

  return `
    <p style="font-size:24px;font-weight:800;color:#ffffff;margin:0 0 6px;line-height:1.2">${n}, here's the whole thing — with pictures.</p>
    <p style="color:#94a3b8;margin:0 0 24px;font-size:15px">The website is the lead. Everything else (visitor intel, fusion alerts, FieldDesk, missed-call, reviews, email blasts) is included in the same monthly fee — not random add-ons.</p>

    <!-- Founder moment -->
    <div style="background:linear-gradient(135deg,#0d1f3c 0%,#13294b 100%);border:2px solid ${DWA_TEAL};border-radius:12px;padding:20px;margin:0 0 28px;text-align:center">
      <p style="color:${DWA_TEAL};font-weight:900;font-size:11px;margin:0 0 8px;letter-spacing:2px">⚡ THE FOUNDER MOMENT</p>
      <p style="color:#ffffff;font-size:15px;font-weight:600;margin:0;line-height:1.55">You're customer #1 of this stack. Lock today's price <strong>forever</strong>. Every upgrade we ship — and we ship every single day — is yours, free, for as long as you're with us. No price hikes. Ever. In writing.</p>
    </div>

    <!-- Pricing first -->
    <h2 style="color:#ffffff;font-size:18px;font-weight:800;margin:0 0 4px;border-bottom:2px solid ${DWA_TEAL};padding-bottom:6px">The offer</h2>
    <div style="background:#0d1f3c;border-left:3px solid ${DWA_TEAL};padding:18px 22px;border-radius:0 8px 8px 0;margin:14px 0 6px">
      <p style="margin:0 0 10px;color:#e2e8f0;font-size:14px"><strong style="color:${DWA_TEAL}">Option A — All-in monthly:</strong> $499/mo. Zero upfront. Cancel anytime.</p>
      <p style="margin:0 0 10px;color:#e2e8f0;font-size:14px"><strong style="color:${DWA_TEAL}">Option B — Build + Maintain:</strong> $499 one-time + $199/mo. Lower recurring.</p>
      <p style="margin:0;color:#94a3b8;font-size:13px"><strong style="color:#cbd5e1">Optional:</strong> RB2B person-level visitor ID — +$300/mo at our cost (transparent pass-through).</p>
    </div>
    <p style="color:#94a3b8;font-size:12px;margin:8px 0 28px;font-style:italic">Same scope, same Forever Pricing on either option. Pick the cash flow you prefer.</p>

    <!-- ROI math -->
    <h2 style="color:#ffffff;font-size:18px;font-weight:800;margin:8px 0 4px;border-bottom:2px solid ${DJC_RED};padding-bottom:6px">Why $499/mo is a rounding error</h2>
    ${roiBlock}

    <!-- Section 1: New website -->
    <h2 style="color:#ffffff;font-size:18px;font-weight:800;margin:32px 0 4px;border-bottom:2px solid ${DWA_TEAL};padding-bottom:6px">1 · A new djconley.com — your colors, your branding</h2>
    <p style="color:#cbd5e1;margin:8px 0 0">Brand-new site, your real teal + red palette, mobile-perfect, fast, ranks for "commercial boiler Detroit". This is what carries everything else.</p>
    ${sitePreview}
    <p style="text-align:center;margin:8px 0 0">
      <a href="${DEMO_A_URL}" style="display:inline-block;background:${DJC_TEAL};color:#0a1628;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:800;font-size:13px;margin:4px">→ Open Demo A (your real palette)</a>
      <a href="${DEMO_B_URL}" style="display:inline-block;background:#1e293b;color:${DWA_TEAL};border:1px solid ${DWA_TEAL};padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px;margin:4px">→ Open Demo B (industrial alt)</a>
    </p>

    <!-- Section 2: Owner Dashboard -->
    <h2 style="color:#ffffff;font-size:18px;font-weight:800;margin:32px 0 4px;border-bottom:2px solid ${DWA_TEAL};padding-bottom:6px">2 · Your Owner Dashboard</h2>
    <p style="color:#cbd5e1;margin:8px 0 0">Magic-link login at <strong style="color:${DWA_TEAL}">djconley.com/admin</strong>. No password. Edit hero text, photos, services yourself. This is mission control:</p>
    ${dashboardMock}

    <!-- Section 3: Command Center -->
    <h2 style="color:#ffffff;font-size:18px;font-weight:800;margin:32px 0 4px;border-bottom:2px solid ${DJC_RED};padding-bottom:6px">3 · Command Center — every tab, one place</h2>
    <p style="color:#cbd5e1;margin:8px 0 0">eWay, FieldServio, QuickBooks, Gmail, BSEED, MITN, your bank — all pinned inside your dashboard. One click each.</p>
    ${commandCenterMock}

    <!-- Section 4: SiteRadar -->
    <h2 style="color:#ffffff;font-size:18px;font-weight:800;margin:32px 0 4px;border-bottom:2px solid ${DWA_TEAL};padding-bottom:6px">4 · SiteRadar Pro — who's on your site right now</h2>
    <p style="color:#cbd5e1;margin:8px 0 12px">We identify the <strong style="color:${DWA_TEAL}">company</strong> instantly when they hit your site, then surface the most likely decision-maker so you have someone to call.</p>
    ${siteRadarMock}

    <!-- Section 5: Fusion -->
    <h2 style="color:#ffffff;font-size:18px;font-weight:800;margin:32px 0 4px;border-bottom:2px solid ${DJC_RED};padding-bottom:6px">5 · Predictive Sales Fusion — the wedge</h2>
    <p style="color:#cbd5e1;margin:8px 0 0">SiteRadar visits + active MITN.info RFPs + BSEED permit velocity, tied together in one SMS. Nobody else does this.</p>
    ${fusionMock}

    <!-- Section 6: FieldDesk -->
    <h2 style="color:#ffffff;font-size:18px;font-weight:800;margin:32px 0 4px;border-bottom:2px solid ${DWA_TEAL};padding-bottom:6px">6 · FieldDesk — runs <em>next to</em> eWay, not instead of it</h2>
    <p style="color:#cbd5e1;margin:8px 0 0"><strong style="color:#fff">eWay stays. Period.</strong> FieldDesk lives inside the same admin as a second window. Live tech GPS, customer auto-SMS (en route / on site / complete), photo-stamped completion, instant review request after every job. Run both. Decide later.</p>
    ${fieldDeskMock}

    <!-- Section 7: Missed-call + reviews -->
    <h2 style="color:#ffffff;font-size:18px;font-weight:800;margin:32px 0 4px;border-bottom:2px solid ${DWA_TEAL};padding-bottom:6px">7 · Missed-Call Text-Back + Review Engine</h2>
    <p style="color:#cbd5e1;margin:8px 0 0">Every missed call gets a text in &lt; 60 seconds. Every completed job triggers a Google review request. Two-way SMS inbox in your dashboard.</p>
    ${smsCenterMock}

    <!-- Section 8: Email Blast -->
    <h2 style="color:#ffffff;font-size:18px;font-weight:800;margin:32px 0 4px;border-bottom:2px solid ${DJC_RED};padding-bottom:6px">8 · Email Blast Engine — total control</h2>
    <p style="color:#cbd5e1;margin:8px 0 0">Three modes: Manual / Recurring seasonal / Trigger-based ("email everyone 6 months after their last service"). Master kill switch. Nothing fires that you didn't approve.</p>
    ${emailBlastMock}

    <!-- Zero disruption -->
    <div style="background:#0d1f3c;border-left:3px solid ${DJC_RED};padding:18px 22px;border-radius:0 8px 8px 0;margin:32px 0 24px">
      <p style="color:#ffffff;font-weight:700;font-size:14px;margin:0 0 10px;letter-spacing:0.5px">ZERO eWAY / FIELDSERVIO DISRUPTION</p>
      <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.6">eWay keeps doing dispatch and contacts. FieldServio keeps doing ERP. We're the marketing + intelligence layer that sits on top. Nobody on your team has to learn anything new or change a single workflow.</p>
    </div>

    <!-- Iteration promise -->
    <div style="background:#0d1f3c;border:2px solid ${DJC_RED};border-radius:10px;padding:16px 18px;margin:14px 0">
      <p style="margin:0;color:#fff;font-size:14px"><strong style="color:${DJC_RED}">We're not happy until you're happy.</strong> Don't like a color, font, layout, photo, headline, anything? Reply and tell me. Unlimited revisions. We don't launch until you say <em>"that's it."</em></p>
    </div>

    <!-- Close -->
    <div style="background:linear-gradient(135deg,${DJC_TEAL} 0%,#1aa49a 100%);border-radius:12px;padding:24px;margin:32px 0 0;text-align:center">
      <p style="color:#0a1628;font-weight:900;font-size:18px;margin:0 0 10px;line-height:1.3">Ready to lock in today's price forever?</p>
      <p style="color:#0a1628;font-size:14px;margin:0 0 16px;font-weight:600;line-height:1.5">Reply <strong>YES A</strong> ($499/mo) or <strong>YES B</strong> ($499 + $199/mo) and I'll send the setup form tonight + a Stripe link in the morning.</p>
      <p style="color:#0a1628;font-size:13px;margin:0;font-weight:700">Or call/text direct: <a href="${PHONE_TEL}" style="color:#0a1628;text-decoration:underline">${PHONE_LABEL}</a></p>
    </div>

    <div style="border-top:1px solid #1e3a5f;padding-top:20px;margin-top:24px">
      <p style="color:#e2e8f0;font-size:14px;margin:0">— Matt Michels</p>
      <p style="color:#4a6fa5;font-size:12px;margin:5px 0 0">Detroit Web Agency &nbsp;·&nbsp; ${PHONE_LABEL} &nbsp;·&nbsp; <a href="mailto:${REPLY_EMAIL}" style="color:${DWA_TEAL};text-decoration:none">${REPLY_EMAIL}</a></p>
      <p style="color:#4a6fa5;font-size:11px;margin:18px 0 0;font-style:italic">P.S. Forever Pricing isn't marketing copy — it's contractually locked. Whatever number you sign at, you stay at. Every new feature ships into your dashboard, free, for as long as you're a customer. That's the whole deal.</p>
    </div>`;
}

function buildPlainText(name: string): string {
  const n = name || "Pat";
  return `${n}, here's the whole thing — with pictures (HTML version recommended).

THE OFFER
- Option A — All-in: $499/mo. Zero upfront. Cancel anytime.
- Option B — Build + Maintain: $499 one-time + $199/mo.
- Optional: RB2B person-level visitor ID +$300/mo at cost.
- Forever Pricing — your price never goes up. Every upgrade ships free.

THE MATH (conservative, one win per category per month)
- 1 recovered missed-call boiler service: +$1,800
- 1 review-driven new customer (LTV): +$4,500
- 1 SiteRadar/Fusion win on a facility account: +$2,000
- 1 seasonal email-blast service call recovered: +$850
Conservative upside: ~$9,150/mo
Less Option A cost ($499). Net ≈ $8,651/mo.

WHAT'S INCLUDED (every option, both prices)
1. New djconley.com — your real teal + red palette, mobile-perfect, ranks for commercial boiler Detroit
2. Owner Dashboard — magic-link login at djconley.com/admin, edit content yourself
3. Command Center — eWay, FieldServio, QuickBooks, Gmail, BSEED, MITN, bank, all pinned in one place
4. SiteRadar Pro — instant SMS the moment a real company hits your site (+ likely decision-maker)
5. Predictive Sales Fusion — SiteRadar visits tied to active MITN RFPs and BSEED permits, ONE SMS
6. FieldDesk — runs NEXT TO eWay (not instead of). Live tech GPS, customer auto-SMS, photo completion
7. Missed-Call Text-Back (<60s) + automated Google review push after every job
8. Email Blast Engine — manual / recurring seasonal / trigger-based. Master kill switch.

ZERO eWAY / FIELDSERVIO DISRUPTION
eWay stays. FieldServio stays. We're the layer on top. Nobody learns anything new.

DEMO LINKS (verified live):
- Demo A (your real teal + red palette): ${DEMO_A_URL}
- Demo B (industrial alt direction):     ${DEMO_B_URL}

We're not happy until you're happy. Unlimited revisions. We don't launch until you say "that's it."

REPLY:
- YES A — go with $499/mo all-in
- YES B — go with $499 + $199/mo
- DEMOS: change X — tell me what to fix on the demo sites
- TABS: [your list] — for the Command Center
Or call/text: ${PHONE_LABEL}

— Matt Michels
Detroit Web Agency · ${REPLY_EMAIL} · ${PHONE_LABEL}

P.S. Forever Pricing is contractually locked. Whatever number you sign at, you stay at — every new feature ships into your dashboard free for as long as you're a customer.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const recipientEmail: string = String(body.recipient_email || "").trim().toLowerCase();
    const firstName: string = String(body.first_name || "Pat").trim();
    const triggeredBy: string = String(body.triggered_by || "manual").trim();

    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return new Response(JSON.stringify({ error: "Valid recipient_email required" }), { status: 400, headers: CORS });
    }

    const html = dwaShell(buildBody(firstName));
    const text = buildPlainText(firstName);
    const messageId = `djconley-proposal-${crypto.randomUUID()}`;

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
      await sb.from("email_send_log").insert({
        message_id: messageId,
        template_name: "djconley_proposal_v3",
        recipient_email: recipientEmail,
        status: "pending",
        metadata: { triggered_by: triggeredBy, product: "DJ Conley Premium" },
      });
    } catch (_) { /* best-effort */ }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Matt Michels — Detroit Web Agency <matt@detroitwebagent.com>",
        to: [recipientEmail],
        bcc: ["matthewmichels4@gmail.com", "matt@detroitwebagent.com"],
        reply_to: REPLY_EMAIL,
        subject: `${firstName} — D.J. Conley + Detroit Web Agency: the whole thing, with pictures`,
        html,
        text,
        headers: { "X-Entity-Ref-ID": messageId },
        tags: [
          { name: "template", value: "djconley_proposal_v3" },
          { name: "channel", value: "outreach_proposal" },
        ],
      }),
    });

    const resendBody = await resendRes.json().catch(() => ({}));

    try {
      await sb.from("email_send_log").insert({
        message_id: messageId,
        template_name: "djconley_proposal_v3",
        recipient_email: recipientEmail,
        status: resendRes.ok ? "sent" : "failed",
        error_message: resendRes.ok ? null : JSON.stringify(resendBody).slice(0, 500),
        metadata: { resend_id: resendBody?.id, status_code: resendRes.status, triggered_by: triggeredBy },
      });
    } catch (_) { /* best-effort */ }

    if (!resendRes.ok) {
      console.error("[send-djconley-proposal] Resend error", resendBody);
      return new Response(JSON.stringify({ error: "Resend send failed", detail: resendBody }), { status: 502, headers: CORS });
    }

    try {
      await sb.from("notifications" as any).insert({
        type: "outreach_proposal",
        title: `DJ Conley proposal v3 sent → ${recipientEmail}`,
        body: `Upgraded post-meeting proposal delivered. Resend id: ${resendBody?.id || "?"}`,
        link: "/dwa-admin",
        urgency: "fyi",
        category: "outreach",
      });
    } catch (logErr) {
      console.warn("[send-djconley-proposal] audit log failed (non-fatal):", logErr);
    }

    return new Response(JSON.stringify({ sent: true, resend_id: resendBody?.id, to: recipientEmail, message_id: messageId }), { headers: CORS });
  } catch (err) {
    console.error("[send-djconley-proposal] Error", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
