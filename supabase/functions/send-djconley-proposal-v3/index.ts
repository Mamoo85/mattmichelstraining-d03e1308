// send-djconley-proposal-v3 — The Closer
// Subject: "Pat — three things changed since we last talked"
// 5 sections, not 10. Outcomes not features. One YES close.
// Sends to pmichels@djconley.com + patrick.michels@gmail.com, BCC matthewmichels4@gmail.com

import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const TEAL = "#27CCC0";
const RED = "#c12a3b";
const DARK = "#0b1622";
const DARK2 = "#111d2b";
const PANEL = "#152438";
const BORDER = "rgba(39,204,192,0.2)";

// ── Demo frame — clickable preview card ──────────────────────────────────────
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
  <div style="background:${PANEL};border:1px solid ${opts.isNew ? TEAL : BORDER};border-radius:12px;overflow:hidden;transition:all 0.2s">
    <!-- Browser bar -->
    <div style="background:${DARK};padding:10px 16px;display:flex;align-items:center;gap:8px;border-bottom:1px solid ${BORDER}">
      <span style="width:9px;height:9px;border-radius:50%;background:#ef4444;display:inline-block"></span>
      <span style="width:9px;height:9px;border-radius:50%;background:#f59e0b;display:inline-block"></span>
      <span style="width:9px;height:9px;border-radius:50%;background:#22c55e;display:inline-block"></span>
      <span style="background:#0b1622;color:#475569;font-size:11px;padding:3px 10px;border-radius:4px;font-family:monospace;flex:1;margin-left:6px">${opts.url.replace("https://", "")}</span>
      ${opts.isNew ? `<span style="background:${TEAL};color:#fff;font-size:9px;font-weight:800;letter-spacing:1px;padding:2px 8px;border-radius:100px;text-transform:uppercase">NEW</span>` : ""}
    </div>
    <!-- Preview body -->
    <div style="padding:20px 22px">
      <div style="display:inline-block;background:${opts.tagColor}18;color:${opts.tagColor};font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:3px 10px;border-radius:100px;margin-bottom:10px">${opts.tag}</div>
      <div style="color:#e2e8f0;font-size:16px;font-weight:800;line-height:1.3;margin-bottom:6px;letter-spacing:-0.3px">${opts.headline}</div>
      <div style="color:#64748b;font-size:13px;line-height:1.5">${opts.sub}</div>
      <div style="margin-top:14px;color:${opts.tagColor};font-size:12px;font-weight:700">View live demo →</div>
    </div>
  </div>
</a>`;
}

// ── Stat callout block ────────────────────────────────────────────────────────
function statBlock(num: string, label: string, sub: string): string {
  return `
<div style="background:${PANEL};border-left:3px solid ${TEAL};border-radius:0 10px 10px 0;padding:18px 22px;margin:20px 0">
  <div style="font-size:36px;font-weight:900;color:${TEAL};letter-spacing:-2px;line-height:1">${num}</div>
  <div style="font-size:14px;font-weight:700;color:#e2e8f0;margin-top:4px">${label}</div>
  <div style="font-size:13px;color:#64748b;margin-top:3px">${sub}</div>
</div>`;
}

// ── Section divider ───────────────────────────────────────────────────────────
const divider = `<div style="height:1px;background:${BORDER};margin:32px 0"></div>`;

// ── Full email HTML ───────────────────────────────────────────────────────────
function buildEmail(name: string): string {
  const n = name || "Pat";

  const body = `
<!-- GREETING -->
<p style="color:#e2e8f0;font-size:16px;line-height:1.7;margin:0 0 16px">${n},</p>

<!-- SECTION 1: HOOK -->
<p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 12px">
  Three things changed since we last talked.
</p>
<p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 12px">
  I built two new demos from scratch — completely different directions, both using your actual brand colors. And we launched a new capability I didn't show you last time: federal contract signal tracking that would have flagged the Stellantis RFP before it posted publicly.
</p>
<p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 0">
  I want to make this easy for you to say yes to. Here's everything, short version.
</p>

${divider}

<!-- SECTION 2: THE FOUR DEMOS -->
<p style="color:#e2e8f0;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 18px">Four Site Directions — Click Any to See Live</p>

${demoFrame({
  label: "Demo A",
  tag: "Bold Industrial",
  tagColor: "#E07B39",
  headline: "D.J. Conley Associates",
  sub: "Navy + orange direction. Strong industrial feel, services-forward layout.",
  url: "https://detroitwebagent.com/demo-djconley-1",
})}

${demoFrame({
  label: "Demo B",
  tag: "Brand Colors",
  tagColor: TEAL,
  headline: "D.J. Conley Associates",
  sub: "Your actual teal + red colors. Clean, modern, conversion-optimized.",
  url: "https://detroitwebagent.com/demo-djconley-2",
})}

${demoFrame({
  label: "Demo C",
  tag: "Authority & Scale",
  tagColor: TEAL,
  headline: "Detroit's Commercial Boiler Experts — Since 1957",
  sub: "Premium dark hero, animated stats (65+ years, 400+ clients), Stellantis/Henry Ford logo bar, pull quote section.",
  url: "https://detroitwebagent.com/demo-djconley-3",
  isNew: true,
})}

${demoFrame({
  label: "Demo D",
  tag: "Digital Command",
  tagColor: RED,
  headline: "Commercial Boiler Intelligence. Instant Response.",
  sub: "Split hero with live operations dashboard mock, Stellantis $2.4M case study, 47-minute response timer, dispatch feed.",
  url: "https://detroitwebagent.com/demo-djconley-4",
  isNew: true,
})}

${divider}

<!-- SECTION 3: THE ONE NUMBER -->
<p style="color:#e2e8f0;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 14px">The One Number That Matters</p>

${statBlock("$2.4M", "Stellantis boiler retrofit RFP — active on MITN.info right now", "If SiteRadar had been live on your site last week, you'd have gotten a text the moment their facilities manager hit your site. That's the only number that matters.")}

<p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:16px 0 0">
  You don't need more website traffic. You need to know <em style="color:#e2e8f0">who's already visiting</em> — and get a text the second a Stellantis or Henry Ford procurement contact lands on your page.
</p>

${divider}

<!-- SECTION 4: PRICING — DECIDED FOR HIM -->
<p style="color:#e2e8f0;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 14px">My Recommendation</p>

<div style="background:${PANEL};border:1px solid ${BORDER};border-radius:12px;padding:24px;margin-bottom:20px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
    <div style="background:${TEAL};color:#fff;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:4px 12px;border-radius:100px">Recommended</div>
    <div style="color:#e2e8f0;font-size:16px;font-weight:800">Option A — $499/mo · No setup fee</div>
  </div>
  <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 16px">
    New website on your domain, SiteRadar visitor intelligence, visitor-to-lead alerts, and the full command center. Zero upfront. Cancel anytime.
  </p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div style="background:${DARK2};border-radius:8px;padding:12px 14px">
      <div style="color:${TEAL};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Included</div>
      <div style="color:#94a3b8;font-size:12px;line-height:1.6">New website on djconley.com<br/>SiteRadar visitor intelligence<br/>Lead alert texts (real-time)<br/>Forever pricing lock</div>
    </div>
    <div style="background:${DARK2};border-radius:8px;padding:12px 14px">
      <div style="color:${TEAL};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Why start here</div>
      <div style="color:#94a3b8;font-size:12px;line-height:1.6">Zero risk — cancel anytime<br/>ROI visible in 30 days<br/>Upgrade to Option B after<br/>90 days if the math is obvious</div>
    </div>
  </div>
</div>

<p style="color:#64748b;font-size:13px;line-height:1.6;margin:0">
  Option B ($799/mo) adds the full Google + Meta ad management layer on top. I'd start with A, prove the ROI, then layer ads in once you've seen the site convert. That's what I'd do if it were my business.
</p>

${divider}

<!-- SECTION 5: THE CLOSE -->
<p style="color:#e2e8f0;font-size:18px;font-weight:800;letter-spacing:-0.5px;margin:0 0 12px">Reply YES. That's it.</p>

<p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 12px">
  Reply YES and I'll send the contract today. We can be live within 5 business days.
</p>
<p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0 0 28px">
  Or call me directly: <a href="tel:+13139921219" style="color:${TEAL};font-weight:700;text-decoration:none">(313) 992-1219</a>. I'll answer.
</p>

<!-- SIGNATURE -->
<div style="border-top:1px solid ${BORDER};padding-top:24px;margin-top:8px">
  <div style="color:#e2e8f0;font-size:14px;font-weight:800;margin-bottom:2px">Matt Michels</div>
  <div style="color:#64748b;font-size:13px">Detroit Web Agency · Grosse Pointe Park, MI</div>
  <div style="margin-top:8px">
    <a href="tel:+13139921219" style="color:${TEAL};font-size:13px;font-weight:600;text-decoration:none">(313) 992-1219</a>
    <span style="color:#1e3448;margin:0 8px">·</span>
    <a href="https://detroitwebagent.com" style="color:${TEAL};font-size:13px;font-weight:600;text-decoration:none">detroitwebagent.com</a>
  </div>
</div>
`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:640px;margin:0 auto;background:${DARK}">
  <!-- HEADER -->
  <div style="padding:28px 32px 20px;border-bottom:2px solid ${TEAL};text-align:center">
    <div style="color:#fff;font-size:18px;font-weight:900;letter-spacing:3px">DETROIT <span style="color:${TEAL}">WEB AGENCY</span></div>
    <div style="color:${TEAL};font-size:10px;letter-spacing:4px;margin-top:5px;font-weight:600">WE HANDLE THE TECH</div>
  </div>
  <!-- BODY -->
  <div style="padding:36px 32px">${body}</div>
  <!-- FOOTER -->
  <div style="padding:20px 32px;border-top:1px solid #1e3448;text-align:center;background:${DARK2}">
    <p style="margin:0;color:#334155;font-size:12px">Detroit Web Agency · Grosse Pointe Park, MI · (313) 992-1219</p>
    <p style="margin:6px 0 0;font-size:11px"><a href="https://detroitwebagent.com" style="color:${TEAL};text-decoration:none">detroitwebagent.com</a></p>
  </div>
</div>
</body></html>`;
}

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { recipient_email, first_name } = await req.json().catch(() => ({}));

    const to = recipient_email?.trim() || "pmichels@djconley.com";
    const name = first_name?.trim() || "Pat";

    const html = buildEmail(name);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Matt Michels <matt@detroitwebagent.com>",
        to: [to, "patrick.michels@gmail.com"].filter((v, i, a) => a.indexOf(v) === i),
        bcc: ["matthewmichels4@gmail.com"],
        subject: `${name} — three things changed since we last talked`,
        html,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Resend error");

    return new Response(
      JSON.stringify({ ok: true, resend_id: data.id, sent_to: to }),
      { headers: CORS }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e?.message || String(e) }),
      { status: 500, headers: CORS }
    );
  }
});
