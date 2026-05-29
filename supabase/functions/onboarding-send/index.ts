// onboarding-send — sends product-specific setup instructions after a trial starts.
// Called from start-radar-trial (fire-and-forget) for site_radar and missed_call.
// Also callable standalone for re-sends or from onboarding-followup.
import { createClient } from "npm:@supabase/supabase-js@2";
import { dwaEmail } from "../_shared/dwa-email.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "+13139921219";
const SITE = "https://detroitwebagent.com";

// Format Twilio number as (XXX) XXX-XXXX for human display
function formatPhone(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return e164;
}

function pixelSnippet(scriptKey: string): string {
  return `<script>\n(function(k){fetch('${SUPABASE_URL}/functions/v1/visitor-identify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({script_key:k,page:location.href,referrer:document.referrer})})})('${scriptKey}');\n</script>`;
}

function siteRadarEmail(name: string, scriptKey: string, dashboardUrl: string): string {
  const snippet = pixelSnippet(scriptKey);
  const encodedSnippet = encodeURIComponent(snippet);
  const devMailto = `mailto:?subject=Please%20add%20a%20tracking%20snippet%20to%20our%20website&body=Hi%2C%0A%0ACan%20you%20please%20add%20the%20following%20code%20snippet%20to%20the%20%3Chead%3E%20section%20of%20our%20website%3F%0A%0A${encodedSnippet}%0A%0AThis%20is%20for%20our%20SiteRadar%20visitor%20tracking.%20Takes%20about%205%20minutes.%20Thanks!`;

  return `
<div style="font:16px/1.6 -apple-system,Segoe UI,Arial,sans-serif;color:#111;max-width:600px;">

<p style="margin:0 0 16px;">Hey ${name},</p>

<p style="margin:0 0 16px;">Your SiteRadar dashboard is set up and ready to go. One quick step and it will start showing you exactly which companies are visiting your website.</p>

<p style="margin:0 0 12px;font-weight:700;">Here's what you need to add to your website — just copy and paste:</p>

<div style="background:#f4f4f4;border:2px solid #00d4ff;border-radius:8px;padding:16px 18px;margin:0 0 20px;font-family:monospace;font-size:12px;word-break:break-all;line-height:1.7;white-space:pre-wrap;">${snippet.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>

<p style="margin:0 0 8px;">Copy that code, then follow whichever step matches your website:</p>

<table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:0 0 20px;">

<tr><td style="padding:12px 0;border-top:1px solid #e5e7eb;">
<strong style="color:#0a58ca;">WordPress</strong><br>
<span style="font-size:14px;color:#555;">1. Log in to your WordPress dashboard<br>
2. On the left side, click <strong>Appearance</strong> → <strong>Theme File Editor</strong><br>
3. On the right side, click <strong>header.php</strong><br>
4. Find the line that says <code style="background:#f4f4f4;padding:1px 4px;">&lt;/head&gt;</code><br>
5. Paste your code on the line ABOVE that<br>
6. Click <strong>Update File</strong></span>
</td></tr>

<tr><td style="padding:12px 0;border-top:1px solid #e5e7eb;">
<strong style="color:#0a58ca;">Squarespace</strong><br>
<span style="font-size:14px;color:#555;">1. Log in to Squarespace<br>
2. Click the gear icon (<strong>Settings</strong>) in the left menu<br>
3. Click <strong>Advanced</strong><br>
4. Click <strong>Code Injection</strong><br>
5. Paste your code in the <strong>Header</strong> box<br>
6. Click <strong>Save</strong></span>
</td></tr>

<tr><td style="padding:12px 0;border-top:1px solid #e5e7eb;">
<strong style="color:#0a58ca;">Wix</strong><br>
<span style="font-size:14px;color:#555;">1. Log in to Wix<br>
2. Click <strong>Settings</strong> in the left menu<br>
3. Click <strong>Custom Code</strong><br>
4. Click <strong>+ Add Custom Code</strong><br>
5. Paste your code<br>
6. Under "Place Code in," select <strong>Head</strong><br>
7. Click <strong>Apply</strong></span>
</td></tr>

<tr><td style="padding:12px 0;border-top:1px solid #e5e7eb;">
<strong style="color:#0a58ca;">GoDaddy Website Builder</strong><br>
<span style="font-size:14px;color:#555;">1. Log in to GoDaddy<br>
2. Go to your website → click <strong>Edit Website</strong><br>
3. Click <strong>Settings</strong> → <strong>SEO</strong><br>
4. Find <strong>Header Code</strong> and paste your code there<br>
5. Click <strong>Save</strong></span>
</td></tr>

<tr><td style="padding:12px 0;border-top:1px solid #e5e7eb;">
<strong style="color:#0a58ca;">Shopify</strong><br>
<span style="font-size:14px;color:#555;">1. Log in to Shopify admin<br>
2. Click <strong>Online Store</strong> → <strong>Themes</strong><br>
3. Next to your current theme, click <strong>Actions</strong> → <strong>Edit Code</strong><br>
4. Click on <strong>theme.liquid</strong><br>
5. Find <code style="background:#f4f4f4;padding:1px 4px;">&lt;/head&gt;</code> and paste your code just above it<br>
6. Click <strong>Save</strong></span>
</td></tr>

</table>

<p style="margin:0 0 20px;padding:16px;background:#fff8e1;border-left:4px solid #f59e0b;border-radius:4px;font-size:15px;">
<strong>Don't see your website platform listed?</strong> Or not sure which one you use?<br><br>
<strong>Option A:</strong> <a href="${devMailto}" style="color:#0a58ca;">Click here to forward these instructions to your web developer</a> — they'll handle it in minutes.<br><br>
<strong>Option B:</strong> Reply to this email or text Matt at <strong>(313) 992-1219</strong> and he'll do it for you on a quick screen-share call.
</p>

<p style="margin:0 0 16px;">Once it's installed, visitors will start showing up in your dashboard within a few minutes of the first site visit:</p>

<p style="margin:0 0 24px;"><a href="${dashboardUrl}" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:12px 24px;border-radius:6px;font-weight:700;text-decoration:none;">Open my SiteRadar dashboard →</a></p>

<p style="margin:18px 0 4px;">— Matt Michels</p>
<p style="margin:0;color:#555;font-size:14px;">Detroit Web Agency · (313) 992-1219</p>
<p style="margin:12px 0 0;font-size:12px;color:#aaa;"><a href="${SITE}/unsubscribe" style="color:#aaa;">Unsubscribe</a></p>
</div>`;
}

function missedCallEmail(name: string, businessPhone: string, dashboardUrl: string): string {
  const forwardTo = formatPhone(TWILIO_NUMBER);
  const forwardToRaw = TWILIO_NUMBER.replace(/\D/g, "");
  const star72Code = `*72${forwardToRaw}`;

  return `
<div style="font:16px/1.6 -apple-system,Segoe UI,Arial,sans-serif;color:#111;max-width:600px;">

<p style="margin:0 0 16px;">Hey ${name},</p>

<p style="margin:0 0 16px;">Missed-Call Catch is set up and waiting. One step and it will automatically text every missed caller back within 12 seconds — so you never lose a lead to voicemail again.</p>

<p style="margin:0 0 12px;font-weight:700;">What you need to do:</p>

<div style="background:#f0f9ff;border:2px solid #00d4ff;border-radius:8px;padding:20px;margin:0 0 24px;text-align:center;">
<p style="margin:0 0 8px;font-size:14px;color:#555;">Forward missed calls from <strong>${businessPhone || "your business line"}</strong> to:</p>
<p style="margin:0;font-size:32px;font-weight:900;color:#0a1628;letter-spacing:2px;">${forwardTo}</p>
<p style="margin:8px 0 0;font-size:12px;color:#888;">That's the Detroit Web Agency catch line. Missed calls route here, we text them back instantly.</p>
</div>

<p style="margin:0 0 8px;">Follow whichever step matches your phone system:</p>

<table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:0 0 20px;">

<tr><td style="padding:12px 0;border-top:1px solid #e5e7eb;">
<strong style="color:#0a58ca;">RingCentral (most common for small businesses)</strong><br>
<span style="font-size:14px;color:#555;">1. Log in at <strong>app.ringcentral.com</strong><br>
2. Click your profile photo (top right) → <strong>Admin Portal</strong><br>
3. Click <strong>Phone System</strong> → <strong>Phone Numbers</strong><br>
4. Click on your number → <strong>Edit</strong><br>
5. Under "Call Handling," find <strong>Call Forwarding</strong><br>
6. Add <strong>${forwardTo}</strong> as a forwarding number<br>
7. Set it to forward after your desired number of rings<br>
8. Click <strong>Save</strong></span>
</td></tr>

<tr><td style="padding:12px 0;border-top:1px solid #e5e7eb;">
<strong style="color:#0a58ca;">Regular landline or cell (AT&amp;T, Verizon, T-Mobile, Comcast Business)</strong><br>
<span style="font-size:14px;color:#555;">From the business phone that callers dial, dial this exact code and press Call:<br>
<code style="background:#f4f4f4;border:1px solid #ddd;padding:4px 10px;border-radius:4px;font-size:16px;font-weight:bold;">${star72Code}</code><br>
You'll hear a confirmation tone. That's it — forwarding is on.<br>
<em style="color:#888;">To turn it off later, dial *73 from the same phone.</em></span>
</td></tr>

<tr><td style="padding:12px 0;border-top:1px solid #e5e7eb;">
<strong style="color:#0a58ca;">Google Voice</strong><br>
<span style="font-size:14px;color:#555;">1. Go to <strong>voice.google.com</strong><br>
2. Click the gear icon (Settings) in the top right<br>
3. Click <strong>Calls</strong><br>
4. Under "Forward to," click <strong>Add a phone</strong><br>
5. Enter <strong>${forwardTo}</strong><br>
6. Verify the number when prompted</span>
</td></tr>

<tr><td style="padding:12px 0;border-top:1px solid #e5e7eb;">
<strong style="color:#0a58ca;">Vonage, 8x8, Nextiva, or other VoIP</strong><br>
<span style="font-size:14px;color:#555;">Log in to your phone system's admin portal → find your number → look for <strong>"Call Forwarding"</strong> or <strong>"Missed Call Routing"</strong> → enter <strong>${forwardTo}</strong>.<br>
Each system is slightly different — if you're not sure where to find it, call their support line and say: "I need to forward missed calls to an external number."</span>
</td></tr>

</table>

<p style="margin:0 0 20px;padding:16px;background:#fff8e1;border-left:4px solid #f59e0b;border-radius:4px;font-size:15px;">
<strong>Not sure what phone system you use?</strong><br><br>
Reply to this email or text Matt at <strong>(313) 992-1219</strong> with "phone setup" — he'll figure it out and walk you through it in under 10 minutes.
</p>

<p style="margin:0 0 16px;">Once forwarding is set up, every missed call to your line will auto-text the caller and show up in your dashboard:</p>

<p style="margin:0 0 24px;"><a href="${dashboardUrl}" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:12px 24px;border-radius:6px;font-weight:700;text-decoration:none;">Open my Missed-Call dashboard →</a></p>

<p style="margin:18px 0 4px;">— Matt Michels</p>
<p style="margin:0;color:#555;font-size:14px;">Detroit Web Agency · (313) 992-1219</p>
<p style="margin:12px 0 0;font-size:12px;color:#aaa;"><a href="${SITE}/unsubscribe" style="color:#aaa;">Unsubscribe</a></p>
</div>`;
}

function readyEmail(name: string, productLabel: string, dashboardUrl: string): string {
  return `
<div style="font:16px/1.6 -apple-system,Segoe UI,Arial,sans-serif;color:#111;max-width:600px;">
<p style="margin:0 0 16px;">Hey ${name},</p>
<p style="margin:0 0 16px;">${productLabel} is live and running — no setup needed on your end. Click below to see what's already in your feed:</p>
<p style="margin:0 0 24px;"><a href="${dashboardUrl}" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:12px 24px;border-radius:6px;font-weight:700;text-decoration:none;">Open my ${productLabel} dashboard →</a></p>
<p style="margin:0 0 16px;font-size:14px;color:#555;">If anything looks off or you have questions, just reply to this email or text (313) 992-1219. — Matt</p>
</div>`;
}

function bundleWelcomeEmail(opts: {
  name: string;
  scriptKey: string;
  businessPhone: string;
  hubUrl: string;
  siteRadarUrl: string;
  missedCallUrl: string;
  demandRadarUrl: string;
  buyerRadarUrl: string;
  industryPulseUrl: string;
}): string {
  const { name, scriptKey, businessPhone, hubUrl, siteRadarUrl, missedCallUrl,
    demandRadarUrl, buyerRadarUrl, industryPulseUrl } = opts;
  const fwdTo = formatPhone(TWILIO_NUMBER);
  const rawDigits = TWILIO_NUMBER.replace(/\D/g, "");
  const snippet = pixelSnippet(scriptKey);

  return `
<div style="font:16px/1.6 -apple-system,Segoe UI,Arial,sans-serif;color:#111;max-width:620px;">

<p style="margin:0 0 16px;">Hey ${name},</p>

<p style="margin:0 0 16px;">I set up five tools for AmeriSteel — three are running right now with no setup needed, two need a quick one-time step from you. Everything is in one place:</p>

<p style="margin:0 0 28px;">
  <a href="${hubUrl}" style="display:inline-block;background:#00d4ff;color:#0a1628;padding:14px 28px;border-radius:6px;font-weight:900;text-decoration:none;font-size:17px;">Open your AmeriSteel Hub →</a>
</p>

<p style="margin:0 0 6px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Bookmark that link — it's everything in one place.</p>

<hr style="border:none;border-top:2px solid #e5e7eb;margin:28px 0;">

<h2 style="margin:0 0 6px;font-size:18px;color:#0a1628;">1. SiteRadar <span style="font-size:13px;font-weight:400;color:#f59e0b;background:#fff8e1;padding:2px 8px;border-radius:4px;">⚠️ 5-minute setup needed</span></h2>
<p style="margin:0 0 12px;font-size:15px;color:#444;"><strong>What it does:</strong> Every time a buyer at Magna, Stellantis, Ford, or any Tier-1 visits ameristeel.com, you'll see the company name, what pages they read, and how many times they came back — before they call anyone else.</p>
<p style="margin:0 0 10px;font-size:15px;"><strong>The one step:</strong> Add this line of code to your website's header:</p>
<div style="background:#f4f4f4;border:2px solid #00d4ff;border-radius:8px;padding:14px 16px;margin:0 0 12px;font-family:monospace;font-size:11px;word-break:break-all;line-height:1.7;">${snippet.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
<p style="margin:0 0 6px;font-size:14px;color:#444;"><strong>WordPress:</strong> Appearance → Theme File Editor → header.php → paste above <code style="background:#f4f4f4;padding:1px 4px;">&lt;/head&gt;</code> → Update File</p>
<p style="margin:0 0 6px;font-size:14px;color:#444;"><strong>Squarespace:</strong> Settings → Advanced → Code Injection → Header → paste → Save</p>
<p style="margin:0 0 6px;font-size:14px;color:#444;"><strong>Wix:</strong> Settings → Custom Code → Add Custom Code → Head → Apply</p>
<p style="margin:0 0 16px;font-size:14px;padding:12px;background:#fff8e1;border-left:3px solid #f59e0b;border-radius:4px;"><strong>Not sure which one?</strong> Forward this email to whoever manages ameristeel.com, or text me "pixel" at (313) 992-1219 and I'll install it for you on a quick call.</p>
<p style="margin:0 0 24px;"><a href="${siteRadarUrl}" style="color:#0a58ca;font-weight:600;">Open SiteRadar dashboard →</a></p>

<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">

<h2 style="margin:0 0 6px;font-size:18px;color:#0a1628;">2. Missed-Call Catch <span style="font-size:13px;font-weight:400;color:#f59e0b;background:#fff8e1;padding:2px 8px;border-radius:4px;">⚠️ 5-minute setup needed</span></h2>
<p style="margin:0 0 12px;font-size:15px;color:#444;"><strong>What it does:</strong> When ${businessPhone || "your business line"} rings and nobody picks up, the caller automatically gets a text from your number within 12 seconds: <em>"Sorry we missed you — what are you looking for?"</em> No more lost quotes to voicemail.</p>
<p style="margin:0 0 10px;font-size:15px;"><strong>Forward missed calls to:</strong></p>
<div style="background:#f0f9ff;border:2px solid #00d4ff;border-radius:8px;padding:16px 20px;margin:0 0 14px;text-align:center;">
  <span style="font-size:30px;font-weight:900;color:#0a1628;letter-spacing:2px;">${fwdTo}</span>
</div>
<p style="margin:0 0 6px;font-size:14px;color:#444;"><strong>Landline or cell (AT&amp;T / Verizon / T-Mobile):</strong> From ${businessPhone || "your business phone"}, dial <code style="background:#f4f4f4;padding:2px 8px;border-radius:4px;font-weight:bold;">*72${rawDigits}</code> and press Call. You'll hear a tone. Done.</p>
<p style="margin:0 0 6px;font-size:14px;color:#444;"><strong>RingCentral:</strong> Admin Portal → Phone Numbers → your number → Call Handling → Add forwarding number → enter ${fwdTo}</p>
<p style="margin:0 0 16px;font-size:14px;padding:12px;background:#fff8e1;border-left:3px solid #f59e0b;border-radius:4px;"><strong>Not sure which phone system you use?</strong> Text me "phone setup" at (313) 992-1219 and I'll walk you through it in 10 minutes.</p>
<p style="margin:0 0 24px;"><a href="${missedCallUrl}" style="color:#0a58ca;font-weight:600;">Open Missed-Call dashboard →</a></p>

<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">

<h2 style="margin:0 0 6px;font-size:18px;color:#0a1628;">3. Demand Radar <span style="font-size:13px;font-weight:400;color:#22c55e;background:#f0fdf4;padding:2px 8px;border-radius:4px;">✅ Live now</span></h2>
<p style="margin:0 0 16px;font-size:15px;color:#444;"><strong>What it does:</strong> Daily feed of public-sector RFPs, government contract awards, and private bid opportunities — filtered for sheet metal / steel fab NAICS codes. Sources include MITN, BidNet, SAM.gov, USAspending, and 40+ others. Check it before your competitors do.</p>
<p style="margin:0 0 28px;"><a href="${demandRadarUrl}" style="color:#0a58ca;font-weight:600;">Open Demand Radar →</a></p>

<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">

<h2 style="margin:0 0 6px;font-size:18px;color:#0a1628;">4. Buyer Radar <span style="font-size:13px;font-weight:400;color:#22c55e;background:#f0fdf4;padding:2px 8px;border-radius:4px;">✅ Live now</span></h2>
<p style="margin:0 0 16px;font-size:15px;color:#444;"><strong>What it does:</strong> Spots automotive Tier-1s and OEM suppliers showing buying-mode signals — hiring surges, new facility permits, capital raises, leadership changes. Get in front of them before the RFQ goes out.</p>
<p style="margin:0 0 28px;"><a href="${buyerRadarUrl}" style="color:#0a58ca;font-weight:600;">Open Buyer Radar →</a></p>

<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">

<h2 style="margin:0 0 6px;font-size:18px;color:#0a1628;">5. Industry Pulse <span style="font-size:13px;font-weight:400;color:#22c55e;background:#f0fdf4;padding:2px 8px;border-radius:4px;">✅ Live now</span></h2>
<p style="margin:0 0 16px;font-size:15px;color:#444;"><strong>What it does:</strong> Week-over-week map of which segments of Michigan automotive manufacturing are expanding — permit velocity, hiring trends, capital flows. Good for knowing where to point your outreach effort each week.</p>
<p style="margin:0 0 28px;"><a href="${industryPulseUrl}" style="color:#0a58ca;font-weight:600;">Open Industry Pulse →</a></p>

<hr style="border:none;border-top:2px solid #e5e7eb;margin:28px 0;">

<p style="margin:0 0 12px;font-size:15px;">Any questions at all — just reply to this email or text me directly:</p>
<p style="margin:0 0 4px;"><strong>(313) 992-1219</strong> — Matt Michels, Detroit Web Agency</p>
<p style="margin:0 0 4px;color:#555;font-size:14px;">matt@detroitwebagent.com</p>
<p style="margin:20px 0 0;font-size:12px;color:#aaa;"><a href="${SITE}/unsubscribe" style="color:#aaa;">Unsubscribe</a></p>
</div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const { email, product, name, dashboard_url, business_phone, bundle_token, resend = false } = await req.json().catch(() => ({}));
  if (!email || !product) {
    return new Response(JSON.stringify({ error: "email and product required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const firstName = name || "there";
  const templateName = `onboarding_${product}`;

  // Dedup — don't re-send unless explicitly requested
  if (!resend) {
    const { count } = await sb.from("email_send_log")
      .select("id", { count: "exact", head: true })
      .eq("recipient_email", email.trim().toLowerCase())
      .eq("template_name", templateName)
      .in("status", ["sent", "pending"]);
    if ((count ?? 0) > 0) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "already_sent" }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
  }

  let subject = "";
  let bodyHtml = "";

  if (product === "site_radar") {
    // Read the actual visitor_script_key from field_crm_clients
    const { data: client } = await sb.from("field_crm_clients")
      .select("visitor_script_key, dispatch_token")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    const scriptKey = client?.visitor_script_key || client?.dispatch_token || "YOUR_KEY";
    const dashUrl = dashboard_url || `${SITE}/my-site-radar?token=${scriptKey}`;
    subject = "Your SiteRadar is ready — 5-minute install (step-by-step inside)";
    bodyHtml = siteRadarEmail(firstName, scriptKey, dashUrl);
  } else if (product === "missed_call") {
    const dashUrl = dashboard_url || `${SITE}/my-missed-call`;
    subject = "Missed-Call Catch is ready — 1 step to activate";
    bodyHtml = missedCallEmail(firstName, business_phone || "", dashUrl);
  } else if (product === "bundle_welcome") {
    // Pull product hrefs from trial_bundles row
    let tbProducts: Array<{ key: string; href: string }> = [];
    if (bundle_token) {
      const { data: tb } = await sb.from("trial_bundles")
        .select("products")
        .eq("bundle_token", bundle_token)
        .maybeSingle();
      tbProducts = tb?.products || [];
    }
    const resolveHref = (key: string) => {
      const p = tbProducts.find((p: { key: string; href: string }) => p.key === key);
      if (!p) return SITE;
      return p.href.startsWith("http") ? p.href : `${SITE}${p.href}`;
    };
    // Pull visitor_script_key from field_crm_clients
    const { data: srClient } = await sb.from("field_crm_clients")
      .select("visitor_script_key, dispatch_token")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    const scriptKey = srClient?.visitor_script_key || srClient?.dispatch_token || "YOUR_KEY";
    subject = "Your AmeriSteel trial suite is live — 5 tools, all in one place";
    bodyHtml = bundleWelcomeEmail({
      name: firstName,
      scriptKey,
      businessPhone: business_phone || "",
      hubUrl: bundle_token ? `${SITE}/hub/${bundle_token}` : SITE,
      siteRadarUrl: resolveHref("site_radar"),
      missedCallUrl: resolveHref("missed_call"),
      demandRadarUrl: resolveHref("demand_radar"),
      buyerRadarUrl: resolveHref("buyer_radar"),
      industryPulseUrl: resolveHref("industry_pulse"),
    });
  } else {
    const LABELS: Record<string, string> = {
      demand_radar: "Demand Radar", buyer_radar: "Buyer Radar",
      industry_pulse: "Industry Pulse", mortgage_radar: "Mortgage Radar",
      techalert: "TechAlert", fielddesk: "FieldDesk",
    };
    const label = LABELS[product] || product;
    subject = `Your ${label} trial is live — here's your dashboard`;
    bodyHtml = readyEmail(firstName, label, dashboard_url || SITE);
  }

  // Log pending
  const msgId = `onboarding-${product}-${crypto.randomUUID()}`;
  await sb.from("email_send_log").insert({
    message_id: msgId, template_name: templateName,
    recipient_email: email.trim().toLowerCase(), status: "pending",
    metadata: { product },
  }).catch(() => {});

  const r = await dwaEmail({ to: email, subject, html: bodyHtml });

  // Log result
  await sb.from("email_send_log").insert({
    message_id: msgId, template_name: templateName,
    recipient_email: email.trim().toLowerCase(),
    status: r.ok ? "sent" : "failed",
    error_message: r.error ?? null,
    metadata: { product, resend: !!resend },
  }).catch(() => {});

  return new Response(JSON.stringify({ ok: r.ok, product, error: r.error }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
