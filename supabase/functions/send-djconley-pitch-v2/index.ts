// Edge function: send-djconley-pitch-v2
// Long-form, visual "wow" pitch to Pat at D.J. Conley.
// Locked to post-meeting plan: eWay STAYS, FieldDesk runs in PARALLEL inside admin panel,
// FieldServio stays, honest SiteRadar framing, no TechAlert pitch.
// New: Command Center hub for all his external tabs.
// All graphics rendered as inline-styled HTML/CSS divs (email-safe, no external images).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const NAVY = "#1B4F8A";
const ORANGE = "#E07B39";
const CREAM = "#FFF5E6";
const TEAL = "#00d4ff";
const DARK = "#0a1628";

function dwaShell(bodyHtml: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:680px;margin:0 auto;background:${DARK}">
  <div style="padding:28px 32px 20px;text-align:center;border-bottom:2px solid ${TEAL}">
    <div style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:3px">DETROIT <span style="color:${TEAL}">WEB AGENCY</span></div>
    <div style="color:${TEAL};font-size:10px;letter-spacing:4px;margin-top:5px;font-weight:600">WE HANDLE THE TECH</div>
  </div>
  <div style="padding:32px;color:#e2e8f0;font-size:15px;line-height:1.7">${bodyHtml}</div>
  <div style="padding:20px 32px;border-top:1px solid #1e3a5f;text-align:center">
    <p style="margin:0;color:#4a6fa5;font-size:12px">Detroit Web Agency · Grosse Pointe Park, MI · (313) 992-1219</p>
    <p style="margin:6px 0 0;font-size:11px"><a href="https://detroitwebagent.com" style="color:${TEAL};text-decoration:none">detroitwebagent.com</a></p>
  </div>
</div></body></html>`;
}

// ── Reusable graphic helpers (all inline CSS, email-safe) ─────────────────────

const browserChrome = (url: string, inner: string) => `
<div style="background:#1e293b;border-radius:10px;overflow:hidden;border:1px solid #334155;margin:14px 0">
  <div style="background:#0f172a;padding:10px 14px;display:flex;align-items:center;border-bottom:1px solid #334155">
    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ef4444;margin-right:6px"></span>
    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#eab308;margin-right:6px"></span>
    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#22c55e;margin-right:14px"></span>
    <span style="background:#0a1628;color:#94a3b8;font-size:11px;padding:4px 10px;border-radius:5px;font-family:monospace">${url}</span>
  </div>
  <div style="background:#ffffff;padding:18px">${inner}</div>
</div>`;

const smsBubble = (from: string, body: string) => `
<div style="margin:10px 0;max-width:380px">
  <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;font-weight:600">${from}</div>
  <div style="background:#1e293b;border:1px solid #00d4ff40;color:#e2e8f0;padding:12px 16px;border-radius:18px 18px 18px 4px;font-size:13px;line-height:1.5">${body}</div>
</div>`;

const tile = (label: string, sub: string, color: string) => `
<td width="33%" style="padding:6px" align="center">
  <div style="background:#ffffff;border:1.5px solid ${color}40;border-radius:10px;padding:14px 8px;text-align:center">
    <div style="font-size:11px;font-weight:800;color:${color};letter-spacing:0.5px;text-transform:uppercase">${label}</div>
    <div style="font-size:10px;color:#64748b;margin-top:4px">${sub}</div>
  </div>
</td>`;

const dashTab = (label: string, active = false) => `
<span style="display:inline-block;padding:6px 12px;margin:2px;border-radius:6px;font-size:11px;font-weight:700;${active ? `background:${NAVY};color:#fff` : `background:#f1f5f9;color:#475569`}">${label}</span>`;

// ── Email body ────────────────────────────────────────────────────────────────

function buildBody(name: string): string {
  const n = name || "Pat";

  // Owner Dashboard mock
  const dashboardMock = browserChrome("djconley.com/admin", `
    <div style="border-bottom:2px solid ${NAVY};padding-bottom:8px;margin-bottom:10px">
      <div style="font-size:14px;font-weight:900;color:${NAVY}">D.J. CONLEY <span style="color:${ORANGE}">DASHBOARD</span></div>
    </div>
    <div style="margin-bottom:12px">
      ${dashTab("Dashboard", true)}${dashTab("Command Center")}${dashTab("Visitor Intel")}${dashTab("Predictive Sales")}${dashTab("Email Campaigns")}${dashTab("Reviews")}${dashTab("Jobs (eWay)")}${dashTab("Content")}${dashTab("Settings")}
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px">
      <tr>
        <td width="33%" style="padding:4px"><div style="background:${CREAM};border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:900;color:${NAVY}">37</div><div style="font-size:10px;color:#64748b;font-weight:600">VISITORS TODAY</div></div></td>
        <td width="33%" style="padding:4px"><div style="background:${CREAM};border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:900;color:${ORANGE}">4</div><div style="font-size:10px;color:#64748b;font-weight:600">HOT ACCOUNTS</div></div></td>
        <td width="33%" style="padding:4px"><div style="background:${CREAM};border-radius:8px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:900;color:${NAVY}">$184k</div><div style="font-size:10px;color:#64748b;font-weight:600">EST. PIPELINE</div></div></td>
      </tr>
    </table>
    <div style="margin-top:10px;background:#f8fafc;border-left:3px solid ${ORANGE};padding:8px 10px;font-size:11px;color:#334155"><strong>What's New:</strong> Fusion v2 shipped this week — free, as promised.</div>
  `);

  // Command Center mock — tile grid
  const commandCenterMock = browserChrome("djconley.com/admin/command-center", `
    <div style="font-size:13px;font-weight:800;color:${NAVY};margin-bottom:8px">Your Command Center — every tab, one click</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>${tile("eWay", "CRM", NAVY)}${tile("FieldServio", "ERP", NAVY)}${tile("QuickBooks", "Accounting", NAVY)}</tr>
      <tr>${tile("Gmail", "Inbox", ORANGE)}${tile("Calendar", "Schedule", ORANGE)}${tile("BSEED", "Permits", ORANGE)}</tr>
      <tr>${tile("MITN.info", "RFPs", NAVY)}${tile("Bank", "Cash", NAVY)}${tile("+ Add Tile", "anything", "#94a3b8")}</tr>
    </table>
    <div style="margin-top:10px;font-size:11px;color:#475569;text-align:center"><em>Drag to reorder. SSO where supported. Open in tab or embed — your call per tile.</em></div>
  `);

  // FieldDesk in parallel mock
  const fieldDeskMock = browserChrome("djconley.com/admin → FieldDesk (running next to eWay)", `
    <div style="font-size:13px;font-weight:800;color:${NAVY};margin-bottom:8px">Today's Crew — Live</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="33%" style="padding:4px;vertical-align:top">
          <div style="background:#fef3c7;border-radius:6px;padding:8px;font-size:11px"><strong style="color:#92400e">EN ROUTE</strong><br/><span style="color:#475569">Mike → Henry Ford Hospital</span><br/><span style="color:#94a3b8;font-size:10px">ETA 14 min</span></div>
        </td>
        <td width="33%" style="padding:4px;vertical-align:top">
          <div style="background:#dbeafe;border-radius:6px;padding:8px;font-size:11px"><strong style="color:${NAVY}">ON SITE</strong><br/><span style="color:#475569">Tony → Stellantis Warren</span><br/><span style="color:#94a3b8;font-size:10px">Boiler #3 tune-up</span></div>
        </td>
        <td width="33%" style="padding:4px;vertical-align:top">
          <div style="background:#dcfce7;border-radius:6px;padding:8px;font-size:11px"><strong style="color:#166534">COMPLETE</strong><br/><span style="color:#475569">Dave → Beaumont Royal Oak</span><br/><span style="color:#94a3b8;font-size:10px">Photos + invoice sent</span></div>
        </td>
      </tr>
    </table>
    <div style="margin-top:10px;background:${CREAM};border-radius:6px;padding:8px;font-size:11px;color:#334155"><strong>Auto-text just sent to customer:</strong> "Tony from D.J. Conley is on site at your boiler now."</div>
  `);

  // SiteRadar mock SMS — HONEST framing
  const siteRadarMock = `
<div style="background:#0d1f3c;border:1px solid ${TEAL}40;border-radius:14px;padding:16px;margin:14px 0">
  <div style="font-size:11px;color:${TEAL};font-weight:700;letter-spacing:1px;margin-bottom:8px">📱 INCOMING SMS — (313) 992-1219 → Pat</div>
  ${smsBubble("SiteRadar · just now", `<strong>Stellantis</strong> just visited your <em>/boiler-tune-up</em> page (4 min, 3 pages).<br/><br/>Likely contact at this org: <strong>Mark Reuss</strong>, VP Facilities — (313) 555-0142, mark.r@stellantis.com<br/><span style="font-size:11px;color:#94a3b8">(Apollo-enriched org contact, not the actual visitor)</span>`)}
</div>`;

  // Predictive Sales Fusion mock
  const fusionMock = `
<div style="background:linear-gradient(135deg,#0d1f3c 0%,#13294b 100%);border:2px solid ${ORANGE};border-radius:14px;padding:18px;margin:14px 0">
  <div style="font-size:11px;color:${ORANGE};font-weight:800;letter-spacing:1.5px;margin-bottom:10px">⚡ FUSION ALERT — THE WEDGE</div>
  ${smsBubble("Predictive Sales · 9:14am", `🔥 <strong>Stellantis</strong> just hit your site AND has an active <strong>$2.4M boiler RFP on MITN.info</strong> (closes in 11 days).<br/><br/>This is the call to make today. Likely contact: Mark Reuss, VP Facilities. Want me to draft the outreach?`)}
  <div style="font-size:11px;color:#94a3b8;margin-top:8px;text-align:center"><em>One SMS. Both signals tied together. No competitor can do this.</em></div>
</div>`;

  // Email Blast Engine mock
  const emailBlastMock = browserChrome("djconley.com/admin → Email Campaigns", `
    <div style="font-size:13px;font-weight:800;color:${NAVY};margin-bottom:10px">Email Blast Engine</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>${tile("Manual Blast", "send now", NAVY)}${tile("Recurring", "seasonal", NAVY)}${tile("Trigger", "6mo since job", NAVY)}</tr>
    </table>
    <div style="margin-top:12px;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px;font-size:12px;color:#991b1b;text-align:center">
      <strong>MASTER KILL SWITCH:</strong> ON ●━━━━━━━ <em>(one tap = all sending stops)</em>
    </div>
  `);

  // SMS / Reviews / Missed-call mock
  const smsCenterMock = `
<div style="background:#0d1f3c;border:1px solid ${TEAL}40;border-radius:14px;padding:16px;margin:14px 0">
  <div style="font-size:11px;color:${TEAL};font-weight:700;letter-spacing:1px;margin-bottom:8px">📱 SMS CENTER — auto-firing</div>
  ${smsBubble("To customer · after job", `Thanks for choosing D.J. Conley! Quick favor — would you leave us a Google review? <a href="#" style="color:${TEAL}">tap here</a>`)}
  ${smsBubble("To missed caller · 38s after hangup", `Hey, sorry we missed you — this is D.J. Conley. What can we help with? Reply here and a real person will answer.`)}
</div>`;

  // Demo previews
  const demoMock = (label: string, url: string) => browserChrome(url, `
    <div style="text-align:center;padding:20px 10px">
      <div style="font-size:18px;font-weight:900;color:${NAVY};margin-bottom:4px">D.J. CONLEY <span style="color:${ORANGE}">MECHANICAL</span></div>
      <div style="font-size:11px;color:#64748b;letter-spacing:1px;margin-bottom:14px">DETROIT'S COMMERCIAL BOILER EXPERTS — SINCE 1957</div>
      <div style="background:${NAVY};color:#fff;padding:10px 18px;border-radius:6px;font-size:12px;font-weight:700;display:inline-block">REQUEST SERVICE →</div>
      <div style="margin-top:10px;font-size:10px;color:#94a3b8">${label}</div>
    </div>
  `);

  return `
    <p style="font-size:24px;font-weight:800;color:#ffffff;margin:0 0 6px;line-height:1.2">${n}, here's the whole thing.</p>
    <p style="color:#94a3b8;margin:0 0 24px;font-size:15px">Top to bottom. With pictures. So you can see exactly what you're getting before you spend a dollar.</p>

    <!-- Founder Moment -->
    <div style="background:linear-gradient(135deg,#0d1f3c 0%,#13294b 100%);border:2px solid ${TEAL};border-radius:12px;padding:20px;margin:0 0 28px;text-align:center">
      <p style="color:${TEAL};font-weight:900;font-size:11px;margin:0 0 8px;letter-spacing:2px">⚡ THE FOUNDER MOMENT</p>
      <p style="color:#ffffff;font-size:15px;font-weight:600;margin:0;line-height:1.55">You're customer #1 of this stack. Lock today's price <strong>forever</strong>. Every upgrade we ship — and we ship every single day — is yours, free, for as long as you're with us. No price hikes. Ever. In writing.</p>
    </div>

    <!-- Section 1: Owner Dashboard -->
    <h2 style="color:#ffffff;font-size:18px;font-weight:800;margin:28px 0 4px;border-bottom:2px solid ${TEAL};padding-bottom:6px">1 · Your Owner Dashboard</h2>
    <p style="color:#cbd5e1;margin:8px 0 0">A login at <strong style="color:${TEAL}">djconley.com/admin</strong>. Magic-link, no password to remember. This is mission control:</p>
    ${dashboardMock}

    <!-- Section 2: Command Center (THE NEW ASK) -->
    <h2 style="color:#ffffff;font-size:18px;font-weight:800;margin:32px 0 4px;border-bottom:2px solid ${ORANGE};padding-bottom:6px">2 · Command Center — every tab, one place</h2>
    <p style="color:#cbd5e1;margin:8px 0 0">You said it best: you're bouncing between eWay, FieldServio, QuickBooks, Gmail, BSEED, MITN, your bank — all day long. Done. We pin every one of them inside your dashboard. One click each. SSO where it's supported, deep-link where it's not.</p>
    ${commandCenterMock}
    <div style="background:#0d1f3c;border-left:3px solid ${ORANGE};padding:14px 18px;border-radius:0 8px 8px 0;margin:14px 0 0">
      <p style="margin:0;color:#e2e8f0;font-size:14px"><strong style="color:${ORANGE}">Reply with the list of every tab you bounce between today</strong> — eWay, FieldServio, QuickBooks, Gmail, BSEED, MITN, payroll, bank, anything — and I'll wire them all in before launch. Drag-to-reorder, custom labels, your call.</p>
    </div>

    <!-- Section 3: FieldDesk in PARALLEL -->
    <h2 style="color:#ffffff;font-size:18px;font-weight:800;margin:32px 0 4px;border-bottom:2px solid ${TEAL};padding-bottom:6px">3 · FieldDesk — runs <em>next to</em> eWay, not instead of it</h2>
    <p style="color:#cbd5e1;margin:8px 0 0"><strong style="color:#fff">eWay stays. Period.</strong> FieldDesk lives inside your admin panel as a second window. Your dispatcher and crew try it side-by-side, on your timeline. If it wins, great. If eWay wins, you've lost nothing. We are not pulling you off eWay.</p>
    ${fieldDeskMock}
    <p style="color:#94a3b8;margin:8px 0 0;font-size:13px">What FieldDesk adds that eWay doesn't: live tech GPS, auto-SMS to the customer (en route / on site / complete), photo-stamped completion, instant review request after every job. Run both. Decide later.</p>

    <!-- Section 4: SiteRadar Pro (HONEST framing) -->
    <h2 style="color:#ffffff;font-size:18px;font-weight:800;margin:32px 0 4px;border-bottom:2px solid ${TEAL};padding-bottom:6px">4 · SiteRadar Pro — who's on your site right now</h2>
    <p style="color:#cbd5e1;margin:8px 0 12px"><strong>I'm going to be straight with you</strong> on what this does: we identify the <strong style="color:${TEAL}">company</strong> instantly the moment they hit your site. Then we surface the <strong style="color:${TEAL}">most likely decision-maker</strong> at that company so you have someone to call. That's Apollo + LinkedIn data on the org — not literally "person X visited."</p>
    ${siteRadarMock}
    <p style="color:#94a3b8;margin:8px 0 0;font-size:13px"><strong style="color:#cbd5e1">Want actual person-level ID?</strong> There's an opt-in add-on (RB2B) at <strong>+$300/mo at our cost — zero markup</strong>. You decide if it's worth it. No pressure.</p>

    <!-- Section 5: Predictive Sales Fusion -->
    <h2 style="color:#ffffff;font-size:18px;font-weight:800;margin:32px 0 4px;border-bottom:2px solid ${ORANGE};padding-bottom:6px">5 · Predictive Sales Fusion — the wedge</h2>
    <p style="color:#cbd5e1;margin:8px 0 0">This is the one nobody else can do. We tie SiteRadar visits to active RFPs on MITN.info, BSEED permit velocity, and industry signals — and send you <strong>one</strong> SMS with all of it tied together:</p>
    ${fusionMock}

    <!-- Section 6: Email Blast Engine -->
    <h2 style="color:#ffffff;font-size:18px;font-weight:800;margin:32px 0 4px;border-bottom:2px solid ${TEAL};padding-bottom:6px">6 · Email Blast Engine — you're in total control</h2>
    <p style="color:#cbd5e1;margin:8px 0 0">Three modes, one master kill switch. You decide what goes out and when. Nothing fires automatically that you didn't approve.</p>
    ${emailBlastMock}

    <!-- Section 7: SMS / Reviews / Missed-call -->
    <h2 style="color:#ffffff;font-size:18px;font-weight:800;margin:32px 0 4px;border-bottom:2px solid ${TEAL};padding-bottom:6px">7 · SMS, Reviews, Missed-Call Text-Back</h2>
    <p style="color:#cbd5e1;margin:8px 0 0">Every missed call gets a text back in under 60 seconds. Every completed job triggers a Google review request. Two-way SMS inbox lives in your dashboard.</p>
    ${smsCenterMock}

    <!-- Section 8: Demos + iteration promise -->
    <h2 style="color:#ffffff;font-size:18px;font-weight:800;margin:32px 0 4px;border-bottom:2px solid ${ORANGE};padding-bottom:6px">8 · Your demo sites — tell me what to change</h2>
    <p style="color:#cbd5e1;margin:8px 0 0">Two directions, your colors (navy + orange — no more teal). Click around, then tell me what you want different.</p>
    ${demoMock("Demo A", "detroitwebagent.com/demo-djconley-v2")}
    <p style="text-align:center;margin:8px 0"><a href="https://detroitwebagent.com/demo-djconley-v2" style="color:${TEAL};font-weight:700;text-decoration:none">→ Open Demo A</a></p>
    ${demoMock("Demo B", "detroitwebagent.com/demo-djconley-v3")}
    <p style="text-align:center;margin:8px 0"><a href="https://detroitwebagent.com/demo-djconley-v3" style="color:${TEAL};font-weight:700;text-decoration:none">→ Open Demo B</a></p>
    <div style="background:#0d1f3c;border:2px solid ${ORANGE};border-radius:10px;padding:16px 18px;margin:14px 0">
      <p style="margin:0;color:#fff;font-size:14px"><strong style="color:${ORANGE}">We're not happy until you're happy.</strong> Don't like a color, a font, the layout, the photos, the copy, the hero, the navigation — anything? Reply and tell me. We rebuild. Unlimited revisions. We don't launch until you say <em>"that's it."</em></p>
    </div>

    <!-- Pricing -->
    <h2 style="color:#ffffff;font-size:18px;font-weight:800;margin:32px 0 4px;border-bottom:2px solid ${TEAL};padding-bottom:6px">9 · Pricing — pick one</h2>
    <div style="background:#0d1f3c;border-left:3px solid ${TEAL};padding:18px 22px;border-radius:0 8px 8px 0;margin:14px 0">
      <p style="margin:0 0 10px;color:#e2e8f0;font-size:14px"><strong style="color:${TEAL}">Option A — All-in monthly:</strong> $499/mo. Zero upfront. Cancel anytime.</p>
      <p style="margin:0 0 10px;color:#e2e8f0;font-size:14px"><strong style="color:${TEAL}">Option B — Build + Maintain:</strong> $499 one-time + $199/mo. Lower recurring.</p>
      <p style="margin:0;color:#94a3b8;font-size:13px"><strong style="color:#cbd5e1">Optional:</strong> RB2B person-level visitor ID — +$300/mo at our cost (transparent pass-through).</p>
    </div>

    <!-- 90-day roadmap -->
    <h2 style="color:#ffffff;font-size:18px;font-weight:800;margin:32px 0 4px;border-bottom:2px solid ${ORANGE};padding-bottom:6px">10 · What ships next 90 days — free to you</h2>
    <ul style="color:#e2e8f0;font-size:14px;line-height:1.9;padding-left:20px">
      <li>AI phone answering for after-hours calls (real voice, books appointments)</li>
      <li>Fusion v2 — adds federal contract awards + permit velocity to the wedge</li>
      <li>Auto-generated quarterly business review PDFs (you walk into ownership meetings looking like a genius)</li>
      <li>Commercial property intel layer (who owns the building you're servicing, what else they own)</li>
      <li>FieldDesk multi-tech route optimization</li>
    </ul>
    <p style="color:#94a3b8;font-size:13px;font-style:italic;margin:8px 0 0">Forever Pricing means all of this lands in your dashboard at no extra charge.</p>

    <!-- Close -->
    <div style="background:linear-gradient(135deg,${NAVY} 0%,#13294b 100%);border-radius:12px;padding:22px;margin:32px 0 0;text-align:center">
      <p style="color:#fff;font-size:16px;font-weight:700;margin:0 0 14px">Reply with one of these:</p>
      <p style="color:${TEAL};font-size:14px;font-weight:600;margin:0;line-height:2">
        <strong>YES A</strong> — go with $499/mo all-in<br/>
        <strong>YES B</strong> — go with $499 + $199/mo<br/>
        <strong>DEMOS:</strong> change X — tell me what to fix on the demo sites<br/>
        <strong>TABS:</strong> [your list] — for the Command Center<br/>
        Or call/text me direct: <strong style="color:#fff">(313) 992-1219</strong>
      </p>
    </div>

    <p style="color:#94a3b8;font-size:13px;margin:24px 0 0;font-style:italic">P.S. eWay stays. FieldServio stays. We're adding a layer on top through your own website. You're not switching anything — you're gaining a control panel.</p>

    <p style="color:#cbd5e1;margin:20px 0 0">— Matt Michels<br/><span style="color:#94a3b8;font-size:13px">Detroit Web Agency · matt@detroitwebagent.com · (313) 992-1219</span></p>
  `;
}

function buildPlainText(name: string): string {
  const n = name || "Pat";
  return `${n}, here's the whole thing — top to bottom.

THE FOUNDER MOMENT
You're customer #1 of this stack. Lock today's price FOREVER. Every upgrade we ship — and we ship every single day — is yours, free. No price hikes ever. In writing.

1. YOUR OWNER DASHBOARD
A login at djconley.com/admin. Magic-link, no password. Tabs: Dashboard · Command Center · Visitor Intel · Predictive Sales · Email Campaigns · Reviews · Jobs (eWay-lite) · Content · Settings.

2. COMMAND CENTER — every tab, one place
You're bouncing between eWay, FieldServio, QuickBooks, Gmail, BSEED, MITN, your bank all day. We pin every one of them inside your dashboard. One click each. SSO where supported, deep-link where not. Drag to reorder.
=> Reply with your full list of tabs and I'll wire them all in before launch.

3. FIELDDESK — runs NEXT TO eWay, not instead of it
eWay stays. Period. FieldDesk lives inside your admin panel as a second window. Your crew tries both, side-by-side, on YOUR timeline. If FieldDesk wins, great. If eWay wins, you've lost nothing. We are NOT pulling you off eWay.
What FieldDesk adds: live tech GPS, auto-SMS to customer (en route / on site / complete), photo-stamped completion, instant review request.

4. SITERADAR PRO — honest version
We identify the COMPANY instantly when someone hits your site, then surface the most likely decision-maker at that company so you have someone to call. (Apollo + LinkedIn data on the org — not literally "person X visited.")
Want actual person-level ID? Opt-in RB2B add-on, +$300/mo at our cost, zero markup. Your call.

5. PREDICTIVE SALES FUSION — the wedge
We tie SiteRadar visits to active MITN.info RFPs, BSEED permits, and industry signals. ONE SMS, all signals tied together. Example: "Stellantis just hit /boiler-tune-up AND has an active $2.4M MITN RFP — make this call today." Nobody else can do this.

6. EMAIL BLAST ENGINE
Three modes: Manual / Recurring seasonal / Trigger-based. Master kill switch. You're in total control.

7. SMS, REVIEWS, MISSED-CALL TEXT-BACK
Missed calls → text back in <60s. Every completed job → Google review request. Two-way SMS inbox in your dashboard.

8. DEMO SITES — tell me what to change
Demo A: https://detroitwebagent.com/demo-djconley-v2
Demo B: https://detroitwebagent.com/demo-djconley-v3
We're not happy until you're happy. Unlimited revisions. We don't launch until you say "that's it."

9. PRICING
Option A — All-in: $499/mo. Zero upfront.
Option B — Build + Maintain: $499 one-time + $199/mo.
Optional: RB2B person-level ID +$300/mo at cost.

10. SHIPPING NEXT 90 DAYS — FREE TO YOU
- AI phone answering after-hours
- Fusion v2 (federal contracts + permit velocity)
- Auto-generated quarterly business review PDFs
- Commercial property intel layer
- FieldDesk multi-tech route optimization

REPLY:
YES A — $499/mo all-in
YES B — $499 + $199/mo
DEMOS: change X
TABS: [your list]
Or call/text: (313) 992-1219

P.S. eWay stays. FieldServio stays. We're adding a layer on top through your own website. You're not switching anything — you're gaining a control panel.

— Matt Michels
Detroit Web Agency · matt@detroitwebagent.com · (313) 992-1219`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const recipientEmail: string = String(body.recipient_email || "").trim().toLowerCase();
    const firstName: string = String(body.first_name || "Pat").trim();

    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return new Response(JSON.stringify({ error: "Valid recipient_email required" }), { status: 400, headers: CORS });
    }

    const html = dwaShell(buildBody(firstName));
    const text = buildPlainText(firstName);

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Matt Michels — Detroit Web Agency <matt@detroitwebagent.com>",
        to: [recipientEmail],
        bcc: ["matthewmichels4@gmail.com"],
        reply_to: "matt@detroitwebagent.com",
        subject: `${firstName} — the whole thing, top to bottom (D.J. Conley)`,
        html,
        text,
      }),
    });

    const resendBody = await resendRes.json().catch(() => ({}));
    if (!resendRes.ok) {
      console.error("[send-djconley-pitch-v2] Resend error", resendBody);
      return new Response(JSON.stringify({ error: "Resend send failed", detail: resendBody }), { status: 502, headers: CORS });
    }

    try {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await sb.from("notifications" as any).insert({
        type: "outreach_pitch_v2",
        title: `DJ Conley pitch v2 sent → ${recipientEmail}`,
        body: `Long-form visual pitch delivered. Resend id: ${resendBody?.id || "?"}`,
        link: "/dwa-admin",
        urgency: "fyi",
        category: "outreach",
      });
    } catch (e) { console.error("audit log failed", e); }

    return new Response(JSON.stringify({ sent: true, resend_id: resendBody?.id, to: recipientEmail }), { headers: CORS });
  } catch (err) {
    console.error("[send-djconley-pitch-v2] Error", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
