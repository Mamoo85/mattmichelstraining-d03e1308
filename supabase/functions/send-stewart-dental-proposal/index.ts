// send-stewart-dental-proposal
// Re-engagement proposal for Dr. Robert Stewart — Stewart Dental, Grosse Pointe
// Subject: "Dr. Stewart — we built 3 new sites for you. And the price was wrong."
// Tailored stack: Missed-Call Catch, Review Automation, TechAlert, SiteRadar, Admin Panel
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
const DARK = "#0a1628";
const DARK2 = "#0d1f3c";
const PANEL = "#111d2e";
const WARM = "#e2e8f0";
const MUTED = "#64748b";
const BORDER = "rgba(0,212,255,0.2)";
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
  <div style="background:${PANEL};border:1px solid ${opts.isNew ? TEAL : BORDER};border-radius:12px;overflow:hidden">
    <div style="background:${DARK};padding:10px 16px;display:flex;align-items:center;gap:8px;border-bottom:1px solid ${BORDER}">
      <span style="width:9px;height:9px;border-radius:50%;background:#ef4444;display:inline-block"></span>
      <span style="width:9px;height:9px;border-radius:50%;background:#f59e0b;display:inline-block"></span>
      <span style="width:9px;height:9px;border-radius:50%;background:#22c55e;display:inline-block"></span>
      <span style="background:#050d1a;color:#475569;font-size:11px;padding:3px 10px;border-radius:4px;font-family:monospace;flex:1;margin-left:6px">${opts.url.replace("https://", "")}</span>
      ${opts.isNew ? `<span style="background:${TEAL};color:#0a1628;font-size:9px;font-weight:800;letter-spacing:1px;padding:2px 8px;border-radius:100px;text-transform:uppercase">NEW</span>` : ""}
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
  const n = name || "Dr. Stewart";
  const yesALink = `mailto:matt@detroitwebagent.com?subject=Stewart%20Dental%20%E2%80%94%20YES%20Option%20A%20%E2%80%94%20%24499%2Fmo&body=Matt%20%E2%80%94%20let%27s%20go%20with%20Option%20A.%20%24499%2Fmo%20all-in.%0A%0APreferred%20start%20date%3A%20%0ADemo%20I%20prefer%3A%20`;
  const yesBLink = `mailto:matt@detroitwebagent.com?subject=Stewart%20Dental%20%E2%80%94%20YES%20Option%20B%20%E2%80%94%20%24499%20%2B%20%24199%2Fmo&body=Matt%20%E2%80%94%20let%27s%20go%20with%20Option%20B.%20%24499%20setup%20%2B%20%24199%2Fmo.%0A%0APreferred%20start%20date%3A%20%0ADemo%20I%20prefer%3A%20`;
  const tweakLink = `mailto:matt@detroitwebagent.com?subject=Stewart%20Dental%20%E2%80%94%20I%20want%20tweaks%20to%20the%20demo&body=Matt%20%E2%80%94%20I%27m%20interested.%20I%20like%20Demo%20%5BX%5D%20but%20want%20to%20tweak%3A%0A%0A`;

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:${DARK};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:640px;margin:0 auto;background:${DARK}">

  <!-- Header -->
  <div style="padding:28px 32px 20px;text-align:center;border-bottom:2px solid ${TEAL}">
    <div style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:3px">DETROIT <span style="color:${TEAL}">WEB AGENCY</span></div>
    <div style="color:${TEAL};font-size:10px;letter-spacing:4px;margin-top:5px;font-weight:600">WE RUN YOUR ENTIRE ONLINE PRESENCE</div>
  </div>

  <!-- Body -->
  <div style="padding:32px;color:${WARM};font-size:15px;line-height:1.7">

    <!-- Greeting -->
    <p style="font-size:22px;font-weight:800;color:#ffffff;margin:0 0 6px;line-height:1.25">${n} — we owe you an apology.</p>
    <p style="color:#94a3b8;margin:0 0 24px;font-size:15px;line-height:1.6">The proposal we sent a few months ago was priced at $1,499. That was wrong. We recalibrated our entire pricing model and the real number is <strong style="color:#ffffff">$499</strong>. That's the website, the tools, the admin panel, all of it. We also built you three brand-new sites since then. Here they are.</p>

    <!-- Divider -->
    <div style="height:1px;background:${BORDER};margin:28px 0"></div>

    <!-- Demos -->
    <p style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 18px">Three Site Directions — Click Any to See Live</p>

    ${demoFrame({
      label: "Demo A",
      tag: "Teal · Clinical",
      tagColor: TEAL,
      headline: "Stewart Dental — Grosse Pointe",
      sub: "Clean, clinical, trust-first layout. Teal accents with white. The #1 style for practices that want to look premium and established.",
      url: "https://detroitwebagent.com/demo-dental",
    })}

    ${demoFrame({
      label: "Demo B",
      tag: "Warm · Family",
      tagColor: "#f59e0b",
      headline: "Stewart Dental — 35 Years. Grosse Pointe Families.",
      sub: "Warm, inviting, patient-first tone. Perfect for a practice that wants to feel welcoming, not clinical. Great for attracting new families.",
      url: "https://detroitwebagent.com/demo-dental-alt1",
    })}

    ${demoFrame({
      label: "Demo C",
      tag: "Nordic · Minimal",
      tagColor: "#a78bfa",
      headline: "Robert H. Stewart DDS — Modern Dental Care",
      sub: "Minimal, high-end, spa-like feel. White space, light fonts, subtle design. Stands apart from every other dental site in Grosse Pointe.",
      url: "https://detroitwebagent.com/demo-dental-alt2",
      isNew: true,
    })}

    <p style="color:${MUTED};font-size:13px;font-style:italic;margin:8px 0 0">Don't love any of these? Tell me which direction is closest and we'll build you two more. We keep going until it's exactly right.</p>

    <!-- Divider -->
    <div style="height:1px;background:${BORDER};margin:28px 0"></div>

    <!-- Why this matters for a dental practice -->
    <p style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 14px">The Numbers That Keep Dental Practices Up at Night</p>

    <div style="background:${PANEL};border-left:3px solid ${TEAL};border-radius:0 10px 10px 0;padding:18px 22px;margin:0 0 14px">
      <div style="font-size:36px;font-weight:900;color:${TEAL};letter-spacing:-2px;line-height:1">62%</div>
      <div style="font-size:14px;font-weight:700;color:#e2e8f0;margin-top:4px">of dental patients choose a new dentist based on online reviews</div>
      <div style="font-size:13px;color:${MUTED};margin-top:3px">If you're not asking for reviews automatically after every appointment, you're losing to whoever is.</div>
    </div>

    <div style="background:${PANEL};border-left:3px solid #f59e0b;border-radius:0 10px 10px 0;padding:18px 22px;margin:0 0 14px">
      <div style="font-size:36px;font-weight:900;color:#f59e0b;letter-spacing:-2px;line-height:1">$300+</div>
      <div style="font-size:14px;font-weight:700;color:#e2e8f0;margin-top:4px">lost revenue per missed call — average for a dental practice</div>
      <div style="font-size:13px;color:${MUTED};margin-top:3px">Emergency calls that hit voicemail go straight to your competitor. Missed-Call Catch texts them back in under 60 seconds — automatically, 24/7.</div>
    </div>

    <div style="background:${PANEL};border-left:3px solid #a78bfa;border-radius:0 10px 10px 0;padding:18px 22px;margin:0 0 28px">
      <div style="font-size:36px;font-weight:900;color:#a78bfa;letter-spacing:-2px;line-height:1">4.2 mo</div>
      <div style="font-size:14px;font-weight:700;color:#e2e8f0;margin-top:4px">average time-to-hire for a dental hygienist in Metro Detroit (2025)</div>
      <div style="font-size:13px;color:${MUTED};margin-top:3px">Our Talent Radar monitors 47 hiring signals daily and surfaces qualified candidates 30–60 days before they're actively looking. You get first look.</div>
    </div>

    <!-- Divider -->
    <div style="height:1px;background:${BORDER};margin:28px 0"></div>

    <!-- What's included -->
    <p style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 16px">What You Get (Both Options, All Included)</p>

    <ul style="margin:0 0 20px;padding:0 0 0 20px;color:${WARM};font-size:14px;line-height:2.0">
      <li><strong style="color:${TEAL}">New website on your domain</strong> — your colors, your photos, your brand. Fast, mobile-perfect, Google-ranked.</li>
      <li><strong style="color:${TEAL}">Owner Admin Panel</strong> — log in at <code style="background:#0d1f3c;padding:1px 5px;border-radius:3px">/admin</code> and edit text, photos, hours, and services yourself. No calling us. No tickets. No waiting.</li>
      <li><strong style="color:${TEAL}">Missed-Call Text-Back</strong> — when a patient calls and can't get through, they get a text in &lt;60 seconds. "Hi, this is Stewart Dental — sorry we missed you! How can we help?"</li>
      <li><strong style="color:${TEAL}">Automated Review Requests</strong> — after every appointment, your patient gets a text asking for a Google review. Runs itself, 24/7.</li>
      <li><strong style="color:${TEAL}">SiteRadar Visitor Intelligence</strong> — see every company that visits your site. Know which insurance networks, referral groups, or corporate clients are checking you out.</li>
      <li><strong style="color:${TEAL}">Talent Radar (TechAlert)</strong> — monitors hiring signal sources daily and alerts you to dental hygienists and assistants showing early job-change signals — before they post a résumé.</li>
      <li><strong style="color:${TEAL}">Forever Pricing</strong> — whatever you pay today, you pay forever. Every new feature we ship (and we ship constantly) is yours free.</li>
    </ul>

    <!-- Add-ons free 3 months -->
    <div style="background:${DARK2};border:2px solid ${GREEN}44;border-radius:12px;padding:20px 22px;margin:0 0 28px">
      <p style="color:${GREEN};font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;margin:0 0 14px">FREE FOR YOUR FIRST 3 MONTHS — THEN INCLUDED</p>
      ${addonBadge("Missed-Call Catch ($99/mo value)", "$99/mo", true)}
      ${addonBadge("Talent Radar — Hygienist & Assistant Monitor ($149/mo value)", "$149/mo", true)}
      ${addonBadge("SiteRadar — Visitor Intelligence ($49/mo value)", "$49/mo", true)}
      ${addonBadge("Review Automation — after every appointment", "included", true)}
      ${addonBadge("Owner Admin Panel — edit your site yourself", "included", true)}
      <p style="color:${MUTED};font-size:12px;margin:12px 0 0;font-style:italic">All tools run automatically. No logins for your staff, no new workflows, no training required.</p>
    </div>

    <!-- Pricing -->
    <div style="height:1px;background:${BORDER};margin:28px 0"></div>
    <p style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 14px">Two Ways to Get Started</p>

    <div style="background:${PANEL};border:2px solid ${TEAL};border-radius:12px;padding:22px;margin:0 0 14px">
      <div style="display:inline-block;background:${TEAL};color:${DARK};font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:4px 12px;border-radius:100px;margin-bottom:12px">Most Popular</div>
      <div style="color:#ffffff;font-size:18px;font-weight:900;margin-bottom:8px">Option A — $499/mo · Zero Upfront</div>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0">All-in. New website, all tools, admin panel, 3 months of free add-ons, forever pricing. Cancel anytime. No setup fee. We start building the moment you say yes.</p>
    </div>

    <div style="background:${PANEL};border:1px solid ${BORDER};border-radius:12px;padding:22px;margin:0 0 28px">
      <div style="color:#ffffff;font-size:18px;font-weight:900;margin-bottom:8px">Option B — $499 Setup · $199/mo After</div>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0">One-time build fee, then $199/mo. Lower recurring cost. Same website, same tools, same forever pricing. Good if you prefer a lower monthly bill and don't mind the upfront.</p>
    </div>

    <!-- CTA -->
    <div style="background:linear-gradient(135deg,${TEAL} 0%,#0099cc 100%);border-radius:12px;padding:28px;margin:0 0 24px;text-align:center">
      <p style="color:${DARK};font-weight:900;font-size:20px;margin:0 0 8px;line-height:1.3">Ready to get started, Dr. Stewart?</p>
      <p style="color:${DARK};font-size:14px;margin:0 0 20px;font-weight:600">Just click one of the buttons below. That's all it takes — I'll handle everything from there.</p>
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
      <p style="color:${MUTED};font-size:11px;margin:18px 0 0;font-style:italic">P.S. The Forever Pricing guarantee isn't marketing — it's contractually locked. Your price never goes up. Every feature we ship after you sign is yours free for life. And if none of the three demos are right, we'll build two more until you love it.</p>
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
  const n = name || "Dr. Stewart";
  return `${n} — we owe you an apology.

The proposal we sent a few months ago was priced at $1,499. That was wrong. We recalibrated our entire pricing model and the real number is $499. That's the website, the tools, the admin panel, all of it.

We also built you three brand-new sites. Here they are:

→ Demo A (Teal / Clinical): https://detroitwebagent.com/demo-dental
→ Demo B (Warm / Family): https://detroitwebagent.com/demo-dental-alt1
→ Demo C (Nordic / Minimal): https://detroitwebagent.com/demo-dental-alt2

Don't love any of these? Tell me which direction is closest and we'll build two more. We keep going until it's exactly right.

── THE NUMBERS ──

62% of dental patients choose a new dentist based on online reviews.
$300+ lost revenue per missed call — average for a dental practice.
4.2 months average time-to-hire for a dental hygienist in Metro Detroit.

── WHAT YOU GET ──

• New website on your domain — your colors, your photos, fast, mobile-perfect, Google-ranked
• Owner Admin Panel — edit text, photos, hours, and services yourself at /admin
• Missed-Call Text-Back — patients who can't get through get a text in <60 seconds
• Automated Review Requests — every patient gets a Google review request after their appointment
• SiteRadar Visitor Intelligence — see which insurance networks and referral groups visit your site
• Talent Radar — early warning on hygienists and assistants showing job-change signals
• Forever Pricing — your price never goes up. Every new feature we ship is yours free.

── FREE FOR YOUR FIRST 3 MONTHS ──

• Missed-Call Catch ($99/mo value)
• Talent Radar — Hygienist & Assistant Monitor ($149/mo value)
• SiteRadar — Visitor Intelligence ($49/mo value)
• Review Automation (included)
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

P.S. The Forever Pricing guarantee is contractually locked. Your price never goes up. Every feature we ship after you sign is yours free for life. And if none of the three demos are right, we'll build two more until you love it.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const recipientEmail: string = String(body.recipient_email || "").trim().toLowerCase();
    const firstName: string = String(body.first_name || "Dr. Stewart").trim();

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
        subject: `${firstName} — we built 3 new sites for you. And the price was wrong.`,
        html,
        text,
      }),
    });

    const resendBody = await resendRes.json().catch(() => ({}));
    if (!resendRes.ok) {
      console.error("[send-stewart-dental-proposal] Resend error", resendBody);
      return new Response(JSON.stringify({ error: "Resend send failed", detail: resendBody }), { status: 502, headers: CORS });
    }

    try {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await sb.from("notifications" as any).insert({
        type: "outreach_proposal",
        title: `Stewart Dental proposal sent → ${recipientEmail}`,
        body: `Re-engagement proposal (corrected $499 pricing + 3 dental demos). Resend id: ${resendBody?.id || "?"}`,
        link: "/dwa-admin",
        urgency: "fyi",
        category: "outreach",
      });
    } catch { /* non-fatal */ }

    return new Response(JSON.stringify({ sent: true, resend_id: resendBody?.id, to: recipientEmail }), { headers: CORS });
  } catch (err) {
    console.error("[send-stewart-dental-proposal] Error", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
