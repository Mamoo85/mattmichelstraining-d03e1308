import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const HIBP_API_KEY = Deno.env.get("HIBP_API_KEY") || "";
const GOOGLE_PAGESPEED_API_KEY = Deno.env.get("GOOGLE_PAGESPEED_API_KEY") || "";
const DATAFORSEO_LOGIN = Deno.env.get("DATAFORSEO_LOGIN") || "";
const DATAFORSEO_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (product: string, msg: string, data?: unknown) =>
  console.log(`[COLD-SELL:${product}] ${msg}${data ? " — " + JSON.stringify(data) : ""}`);

// ── Shared email sender ────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Detroit Web Agency <matt@detroitwebagent.com>", to: [to], subject, html }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Resend error: ${t}`);
  }
}

// ── Shared HTML wrapper ────────────────────────────────────────────────────
function wrap(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>
body{margin:0;padding:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#e2e8f0}
.container{max-width:640px;margin:0 auto;padding:32px 24px}
h1{color:#00d4ff;font-size:24px;margin-bottom:8px}
h2{color:#00d4ff;font-size:18px;margin-top:24px}
.card{background:#1e293b;border-radius:12px;padding:20px;margin:16px 0;border:1px solid #334155}
.score{font-size:48px;font-weight:800;text-align:center;margin:16px 0}
.badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}
.green{background:#16a34a22;color:#4ade80;border:1px solid #16a34a}
.yellow{background:#ca8a0422;color:#fbbf24;border:1px solid #ca8a04}
.orange{background:#ea580c22;color:#fb923c;border:1px solid #ea580c}
.red{background:#dc262622;color:#f87171;border:1px solid #dc2626}
table{width:100%;border-collapse:collapse;margin:12px 0}
th{text-align:left;color:#94a3b8;font-size:12px;padding:8px;border-bottom:1px solid #334155}
td{padding:8px;font-size:13px;border-bottom:1px solid #1e293b}
.footer{text-align:center;color:#64748b;font-size:11px;margin-top:32px;padding-top:16px;border-top:1px solid #1e293b}
</style></head><body><div class="container"><h1>${title}</h1>${body}
<div class="footer">Detroit Web Agency — detroitwebagent.com<br>Text Matt at (313) 992-1219 with questions</div></div></body></html>`;
}

// ════════════════════════════════════════════════════════════════════════════
// PRODUCT 1: "Am I Breached?" ($4.99) — single email HIBP check
// ════════════════════════════════════════════════════════════════════════════
async function amIBreached(email: string, targetEmail: string) {
  log("breach", "Checking", { targetEmail });
  const res = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(targetEmail)}?truncateResponse=false`, {
    headers: { "hibp-api-key": HIBP_API_KEY, "User-Agent": "DetroitWebAgency" },
  });

  let breaches: Array<{ Name: string; BreachDate: string; DataClasses: string[]; Domain: string }> = [];
  if (res.status === 200) breaches = await res.json();
  else if (res.status !== 404) { await res.text(); }

  const riskLevel = breaches.length === 0 ? "clean" : breaches.length >= 5 ? "critical" : breaches.length >= 3 ? "high" : "medium";
  const riskColors: Record<string, string> = { clean: "green", medium: "yellow", high: "orange", critical: "red" };

  let breachRows = "";
  for (const b of breaches) {
    const dataTypes = b.DataClasses.slice(0, 4).join(", ");
    breachRows += `<tr><td style="color:#f1f5f9;font-weight:600">${b.Name}</td><td>${b.BreachDate}</td><td>${dataTypes}</td></tr>`;
  }

  const html = wrap("🔒 Personal Breach Report", `
    <p style="color:#94a3b8">Report for <strong style="color:#f1f5f9">${targetEmail}</strong></p>
    <div class="card" style="text-align:center">
      <div class="score" style="color:${riskLevel === 'clean' ? '#4ade80' : '#f87171'}">${breaches.length}</div>
      <p style="margin:0">breaches found</p>
      <div style="margin-top:12px"><span class="badge ${riskColors[riskLevel] || 'yellow'}">${riskLevel.toUpperCase()} RISK</span></div>
    </div>
    ${breaches.length > 0 ? `<h2>Breach Details</h2><div class="card"><table><tr><th>Source</th><th>Date</th><th>Data Exposed</th></tr>${breachRows}</table></div>` : '<div class="card"><p style="text-align:center;color:#4ade80">✅ No breaches found for this email address.</p></div>'}
    <h2>What To Do Next</h2>
    <div class="card">
      <ol style="margin:0;padding-left:20px;line-height:1.8">
        <li>Change passwords on any breached accounts immediately</li>
        <li>Enable two-factor authentication everywhere</li>
        <li>Use a unique password for every account</li>
        <li>Consider a password manager</li>
        ${breaches.length >= 3 ? '<li><strong style="color:#00d4ff">Your team may be at risk too — consider our Shield My Team scan ($49 for up to 10 emails)</strong></li>' : ''}
      </ol>
    </div>
  `);

  await sendEmail(email, `🔒 Breach Report: ${breaches.length} breaches found for ${targetEmail}`, html);
  return { breaches: breaches.length, risk: riskLevel };
}

// ════════════════════════════════════════════════════════════════════════════
// PRODUCT 2: "Is My Website Fast?" ($9) — PageSpeed check
// ════════════════════════════════════════════════════════════════════════════
async function isMyWebsiteFast(email: string, url: string) {
  log("speed", "Checking", { url });
  const cleanUrl = url.startsWith("http") ? url : `https://${url}`;

  const [mobileRes, desktopRes] = await Promise.all([
    fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(cleanUrl)}&strategy=mobile&key=${GOOGLE_PAGESPEED_API_KEY}`),
    fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(cleanUrl)}&strategy=desktop&key=${GOOGLE_PAGESPEED_API_KEY}`),
  ]);

  const mobile = await mobileRes.json();
  const desktop = await desktopRes.json();

  const mScore = Math.round((mobile.lighthouseResult?.categories?.performance?.score || 0) * 100);
  const dScore = Math.round((desktop.lighthouseResult?.categories?.performance?.score || 0) * 100);
  const mLCP = mobile.lighthouseResult?.audits?.["largest-contentful-paint"]?.displayValue || "N/A";
  const dLCP = desktop.lighthouseResult?.audits?.["largest-contentful-paint"]?.displayValue || "N/A";
  const mTBT = mobile.lighthouseResult?.audits?.["total-blocking-time"]?.displayValue || "N/A";
  const mCLS = mobile.lighthouseResult?.audits?.["cumulative-layout-shift"]?.displayValue || "N/A";
  const mFCP = mobile.lighthouseResult?.audits?.["first-contentful-paint"]?.displayValue || "N/A";

  const scoreColor = (s: number) => s >= 90 ? "#4ade80" : s >= 50 ? "#fbbf24" : "#f87171";
  const scoreClass = (s: number) => s >= 90 ? "green" : s >= 50 ? "yellow" : "red";

  const html = wrap("⚡ Website Speed Report", `
    <p style="color:#94a3b8">Results for <strong style="color:#f1f5f9">${cleanUrl}</strong></p>
    <div style="display:flex;gap:16px;margin:16px 0">
      <div class="card" style="flex:1;text-align:center">
        <p style="color:#94a3b8;margin:0 0 8px">📱 Mobile</p>
        <div class="score" style="color:${scoreColor(mScore)}">${mScore}</div>
        <span class="badge ${scoreClass(mScore)}">${mScore >= 90 ? 'FAST' : mScore >= 50 ? 'NEEDS WORK' : 'SLOW'}</span>
      </div>
      <div class="card" style="flex:1;text-align:center">
        <p style="color:#94a3b8;margin:0 0 8px">🖥️ Desktop</p>
        <div class="score" style="color:${scoreColor(dScore)}">${dScore}</div>
        <span class="badge ${scoreClass(dScore)}">${dScore >= 90 ? 'FAST' : dScore >= 50 ? 'NEEDS WORK' : 'SLOW'}</span>
      </div>
    </div>
    <h2>Core Web Vitals</h2>
    <div class="card">
      <table>
        <tr><th>Metric</th><th>Mobile</th><th>Desktop</th></tr>
        <tr><td>Largest Contentful Paint (LCP)</td><td>${mLCP}</td><td>${dLCP}</td></tr>
        <tr><td>Total Blocking Time (TBT)</td><td>${mTBT}</td><td>—</td></tr>
        <tr><td>Cumulative Layout Shift (CLS)</td><td>${mCLS}</td><td>—</td></tr>
        <tr><td>First Contentful Paint (FCP)</td><td>${mFCP}</td><td>—</td></tr>
      </table>
    </div>
    <h2>What This Means</h2>
    <div class="card">
      ${mScore < 50 ? '<p style="color:#f87171">⚠️ Your mobile site is loading too slowly. Google penalizes slow sites in search rankings — you may be losing customers before they even see your page.</p>' : ''}
      ${mScore >= 50 && mScore < 90 ? '<p style="color:#fbbf24">Your site loads OK but there\'s room for improvement. Faster sites convert more visitors into customers.</p>' : ''}
      ${mScore >= 90 ? '<p style="color:#4ade80">✅ Your site is fast! Keep it up. Regular monitoring ensures it stays that way.</p>' : ''}
      <p style="color:#00d4ff;margin-top:12px">Want weekly speed monitoring? Our Website Checkup ($9.99/mo) alerts you when your site slows down.</p>
    </div>
  `);

  await sendEmail(email, `⚡ Speed Report: ${cleanUrl} scores ${mScore}/100 (mobile)`, html);
  return { mobile: mScore, desktop: dScore };
}

// ════════════════════════════════════════════════════════════════════════════
// PRODUCT 3: "Google Me" ($14.99) — Local SERP visibility snapshot
// ════════════════════════════════════════════════════════════════════════════
async function googleMe(email: string, businessName: string, city: string) {
  log("google-me", "Checking", { businessName, city });
  const query = `${businessName} ${city}`;
  const auth = btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);

  const serpRes = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify([{ keyword: query, location_name: "United States", language_name: "English", depth: 30 }]),
  });
  const serpData = await serpRes.json();
  const items = serpData?.tasks?.[0]?.result?.[0]?.items || [];

  // Find business position
  let position = "Not found in top 30";
  let posNum = 0;
  for (const item of items) {
    if (item.type === "organic" && (item.title?.toLowerCase().includes(businessName.toLowerCase()) || item.url?.toLowerCase().includes(businessName.toLowerCase().replace(/\s/g, "")))) {
      position = `#${item.rank_absolute}`;
      posNum = item.rank_absolute;
      break;
    }
  }

  // Top 5 organic results
  const topResults = items.filter((i: { type: string }) => i.type === "organic").slice(0, 5);
  let resultsHtml = "";
  for (const r of topResults) {
    const highlight = r.title?.toLowerCase().includes(businessName.toLowerCase()) ? 'style="color:#00d4ff;font-weight:700"' : '';
    resultsHtml += `<tr><td style="color:#94a3b8">#${r.rank_absolute}</td><td ${highlight}>${r.title || "—"}</td><td style="color:#64748b;font-size:11px">${r.domain || "—"}</td></tr>`;
  }

  // Local pack check
  const localPack = items.filter((i: { type: string }) => i.type === "maps" || i.type === "local_pack");
  const inLocalPack = localPack.some((lp: { title?: string }) => lp.title?.toLowerCase().includes(businessName.toLowerCase()));

  const html = wrap("🔍 Google Visibility Snapshot", `
    <p style="color:#94a3b8">Search: "<strong style="color:#f1f5f9">${query}</strong>"</p>
    <div style="display:flex;gap:16px;margin:16px 0">
      <div class="card" style="flex:1;text-align:center">
        <p style="color:#94a3b8;margin:0 0 8px">Search Position</p>
        <div class="score" style="color:${posNum > 0 && posNum <= 3 ? '#4ade80' : posNum > 0 && posNum <= 10 ? '#fbbf24' : '#f87171'}">${position}</div>
      </div>
      <div class="card" style="flex:1;text-align:center">
        <p style="color:#94a3b8;margin:0 0 8px">Google Maps</p>
        <div class="score" style="color:${inLocalPack ? '#4ade80' : '#f87171'}">${inLocalPack ? '✓' : '✗'}</div>
        <span class="badge ${inLocalPack ? 'green' : 'red'}">${inLocalPack ? 'VISIBLE' : 'NOT FOUND'}</span>
      </div>
    </div>
    <h2>Top 5 Search Results</h2>
    <div class="card"><table><tr><th>#</th><th>Title</th><th>Domain</th></tr>${resultsHtml}</table></div>
    <h2>What To Do</h2>
    <div class="card">
      ${posNum === 0 ? '<p style="color:#f87171">Your business doesn\'t appear in the top 30 results. This means potential customers can\'t find you on Google.</p>' : ''}
      ${posNum > 10 ? '<p style="color:#fbbf24">You\'re on page 2+. Only 0.63% of searchers click page 2 results.</p>' : ''}
      ${posNum > 0 && posNum <= 10 ? '<p style="color:#4ade80">You\'re on page 1 — good position. Now optimize to hold it.</p>' : ''}
      <p style="color:#00d4ff;margin-top:12px">Want to track this weekly? Our SEO Guard ($29/mo) monitors your rankings and alerts you when competitors overtake you.</p>
    </div>
  `);

  await sendEmail(email, `🔍 Google Snapshot: "${businessName}" ranks ${position} in ${city}`, html);
  return { position, inLocalPack };
}

// ════════════════════════════════════════════════════════════════════════════
// PRODUCT 4: "Shield My Team" ($49) — up to 10 emails HIBP scan
// ════════════════════════════════════════════════════════════════════════════
async function shieldMyTeam(email: string, companyName: string, emails: string[]) {
  log("shield", "Scanning team", { companyName, count: emails.length });
  const capped = emails.slice(0, 10);
  const results: Array<{ email: string; breaches: number; risk: string; details: string[] }> = [];

  for (const e of capped) {
    const trimmed = e.trim();
    if (!trimmed) continue;
    try {
      const res = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(trimmed)}?truncateResponse=false`, {
        headers: { "hibp-api-key": HIBP_API_KEY, "User-Agent": "DetroitWebAgency" },
      });
      if (res.status === 200) {
        const breaches = await res.json();
        const hasPasswords = breaches.some((b: { DataClasses: string[] }) => b.DataClasses.some((d: string) => d.toLowerCase().includes("password")));
        results.push({
          email: trimmed,
          breaches: breaches.length,
          risk: hasPasswords ? (breaches.length >= 3 ? "critical" : "high") : breaches.length >= 3 ? "medium" : "low",
          details: breaches.map((b: { Name: string }) => b.Name),
        });
      } else {
        if (res.status !== 404) await res.text();
        results.push({ email: trimmed, breaches: 0, risk: "clean", details: [] });
      }
      // HIBP rate limit: 1.5s between requests
      await new Promise(r => setTimeout(r, 1600));
    } catch {
      results.push({ email: trimmed, breaches: -1, risk: "error", details: [] });
    }
  }

  const exposed = results.filter(r => r.breaches > 0).length;
  const riskColors: Record<string, string> = { clean: "green", low: "yellow", medium: "orange", high: "red", critical: "red" };

  let rows = "";
  for (const r of results) {
    rows += `<tr>
      <td style="color:#f1f5f9">${r.email}</td>
      <td>${r.breaches < 0 ? 'Error' : r.breaches}</td>
      <td><span class="badge ${riskColors[r.risk] || 'yellow'}">${r.risk.toUpperCase()}</span></td>
      <td style="color:#94a3b8;font-size:11px">${r.details.slice(0, 3).join(", ")}${r.details.length > 3 ? ` +${r.details.length - 3} more` : ''}</td>
    </tr>`;
  }

  const html = wrap(`🛡️ Team Credential Scan: ${companyName}`, `
    <p style="color:#94a3b8">${capped.length} email${capped.length > 1 ? 's' : ''} scanned against 14B+ breached records</p>
    <div style="display:flex;gap:16px;margin:16px 0">
      <div class="card" style="flex:1;text-align:center">
        <div class="score" style="color:#f87171">${exposed}</div>
        <p style="margin:0">exposed</p>
      </div>
      <div class="card" style="flex:1;text-align:center">
        <div class="score" style="color:#4ade80">${capped.length - exposed}</div>
        <p style="margin:0">clean</p>
      </div>
    </div>
    <h2>Results by Employee</h2>
    <div class="card"><table><tr><th>Email</th><th>Breaches</th><th>Risk</th><th>Sources</th></tr>${rows}</table></div>
    <h2>Recommendations</h2>
    <div class="card">
      <ul style="margin:0;padding-left:20px;line-height:1.8">
        <li>Require password changes for all employees flagged HIGH or CRITICAL</li>
        <li>Enable two-factor authentication company-wide</li>
        <li>Deploy a password manager for your team</li>
        ${exposed > 0 ? '<li style="color:#00d4ff"><strong>Need ongoing monitoring? Our Dark Web Monitor ($49/mo) scans your domain weekly and alerts you to new breaches.</strong></li>' : ''}
      </ul>
    </div>
  `);

  await sendEmail(email, `🛡️ Team Scan Complete: ${exposed}/${capped.length} employees exposed — ${companyName}`, html);
  return { scanned: capped.length, exposed };
}

// ════════════════════════════════════════════════════════════════════════════
// PRODUCT 5: "Spy On My Competitor" ($19) — competitive snapshot
// ════════════════════════════════════════════════════════════════════════════
async function spyOnCompetitor(email: string, yourBusiness: string, competitorUrl: string) {
  log("spy", "Analyzing", { competitorUrl });
  const cleanUrl = competitorUrl.startsWith("http") ? competitorUrl : `https://${competitorUrl}`;

  // Scrape competitor
  let competitorMarkdown = "";
  try {
    const fcRes = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: cleanUrl, formats: ["markdown"], onlyMainContent: true }),
    });
    const fcData = await fcRes.json();
    competitorMarkdown = fcData?.data?.markdown || fcData?.markdown || "";
  } catch { competitorMarkdown = "(Could not scrape competitor website)"; }

  // PageSpeed for competitor
  let compSpeed = 0;
  try {
    const psRes = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(cleanUrl)}&strategy=mobile&key=${GOOGLE_PAGESPEED_API_KEY}`);
    const psData = await psRes.json();
    compSpeed = Math.round((psData.lighthouseResult?.categories?.performance?.score || 0) * 100);
  } catch { /* skip */ }

  // AI analysis
  let analysis = "";
  try {
    const aiRes = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 800,
        messages: [{
          role: "user",
          content: `Analyze this competitor website for "${yourBusiness}". Competitor URL: ${cleanUrl}. Speed score: ${compSpeed}/100.

Website content:
${competitorMarkdown.slice(0, 3000)}

Give a brief competitive analysis:
1. Three things they do well
2. Three weaknesses or opportunities
3. One-sentence verdict

Keep it practical and actionable. No fluff. Do NOT mention any tools, methods, or data sources.`,
        }],
      }),
    });
    const aiData = await aiRes.json();
    analysis = aiData?.choices?.[0]?.message?.content || "Analysis unavailable";
  } catch { analysis = "Analysis could not be generated at this time."; }

  const analysisHtml = analysis.replace(/\n/g, "<br>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  const html = wrap(`🕵️ Competitor Intelligence: ${competitorUrl}`, `
    <p style="color:#94a3b8">Prepared for <strong style="color:#f1f5f9">${yourBusiness}</strong></p>
    <div class="card" style="text-align:center">
      <p style="color:#94a3b8;margin:0 0 8px">Competitor Mobile Speed</p>
      <div class="score" style="color:${compSpeed >= 90 ? '#4ade80' : compSpeed >= 50 ? '#fbbf24' : '#f87171'}">${compSpeed}/100</div>
    </div>
    <h2>Competitive Analysis</h2>
    <div class="card"><div style="line-height:1.7">${analysisHtml}</div></div>
    <div class="card" style="text-align:center">
      <p style="color:#00d4ff">Want to track your competitors weekly? Our Competitor Watch ($49/mo) monitors changes and alerts you automatically.</p>
    </div>
  `);

  await sendEmail(email, `🕵️ Competitor Intel: ${competitorUrl} — speed ${compSpeed}/100`, html);
  return { competitorSpeed: compSpeed };
}

// ════════════════════════════════════════════════════════════════════════════
// PRODUCT 6: "Review My Reviews" ($9.99) — Google reviews analysis
// ════════════════════════════════════════════════════════════════════════════
async function reviewMyReviews(email: string, businessName: string, city: string) {
  log("reviews", "Analyzing", { businessName, city });

  // Find place
  const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(businessName + " " + city)}&inputtype=textquery&fields=place_id,name,rating,user_ratings_total&key=${GOOGLE_MAPS_API_KEY}`;
  const findRes = await fetch(searchUrl);
  const findData = await findRes.json();
  const place = findData?.candidates?.[0];

  if (!place) {
    await sendEmail(email, `⭐ Review Report: ${businessName} — Not Found`, wrap("⭐ Review Report", `
      <div class="card"><p style="text-align:center;color:#f87171">Could not find "${businessName}" in "${city}" on Google Maps. Make sure your Google Business Profile is set up and verified.</p></div>
    `));
    return { found: false };
  }

  // Get place details with reviews
  const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,rating,reviews,user_ratings_total&key=${GOOGLE_MAPS_API_KEY}`;
  const detailRes = await fetch(detailUrl);
  const detailData = await detailRes.json();
  const details = detailData?.result || {};
  const reviews = details.reviews || [];

  const rating = details.rating || place.rating || 0;
  const total = details.user_ratings_total || place.user_ratings_total || 0;

  // Analyze reviews with AI
  let analysis = "";
  if (reviews.length > 0) {
    const reviewTexts = reviews.slice(0, 5).map((r: { rating: number; text: string }) => `${r.rating}★: ${r.text?.slice(0, 200)}`).join("\n");
    try {
      const aiRes = await fetch("https://api.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          max_tokens: 600,
          messages: [{
            role: "user",
            content: `Analyze these Google reviews for "${businessName}". Rating: ${rating}/5, Total: ${total} reviews.

Recent reviews:
${reviewTexts}

Provide:
1. Sentiment summary (2 sentences)
2. Top strength customers mention
3. Top complaint customers mention
4. 2 specific reply templates for negative reviews

Keep it practical. Do NOT mention tools, methods, or data sources.`,
          }],
        }),
      });
      const aiData = await aiRes.json();
      analysis = aiData?.choices?.[0]?.message?.content || "";
    } catch { analysis = ""; }
  }

  const ratingColor = rating >= 4.5 ? "#4ade80" : rating >= 3.5 ? "#fbbf24" : "#f87171";
  const analysisHtml = analysis.replace(/\n/g, "<br>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  let reviewCards = "";
  for (const r of reviews.slice(0, 5)) {
    const stars = "⭐".repeat(Math.round(r.rating || 0));
    reviewCards += `<div style="padding:12px 0;border-bottom:1px solid #334155">
      <div style="display:flex;justify-content:space-between"><strong style="color:#f1f5f9">${r.author_name || "Anonymous"}</strong><span>${stars}</span></div>
      <p style="color:#94a3b8;font-size:12px;margin:4px 0 0">${(r.text || "").slice(0, 200)}${(r.text || "").length > 200 ? "..." : ""}</p>
    </div>`;
  }

  const html = wrap(`⭐ Review Analysis: ${businessName}`, `
    <div style="display:flex;gap:16px;margin:16px 0">
      <div class="card" style="flex:1;text-align:center">
        <p style="color:#94a3b8;margin:0 0 8px">Rating</p>
        <div class="score" style="color:${ratingColor}">${rating}</div>
        <p style="margin:0;color:#94a3b8">out of 5.0</p>
      </div>
      <div class="card" style="flex:1;text-align:center">
        <p style="color:#94a3b8;margin:0 0 8px">Total Reviews</p>
        <div class="score" style="color:#00d4ff">${total}</div>
      </div>
    </div>
    ${analysis ? `<h2>Review Intelligence</h2><div class="card"><div style="line-height:1.7">${analysisHtml}</div></div>` : ''}
    ${reviewCards ? `<h2>Recent Reviews</h2><div class="card">${reviewCards}</div>` : ''}
    <div class="card" style="text-align:center">
      <p style="color:#00d4ff">Want automated review monitoring + response templates? Our Review Monitor ($25/mo) watches your reviews 24/7.</p>
    </div>
  `);

  await sendEmail(email, `⭐ Review Report: ${businessName} — ${rating}/5 (${total} reviews)`, html);
  return { rating, total };
}

// ════════════════════════════════════════════════════════════════════════════
// PRODUCT 7: "Hire-Ready Report" ($29) — single candidate intel
// ════════════════════════════════════════════════════════════════════════════
async function hireReadyReport(email: string, candidateName: string, candidateEmail: string, trade: string) {
  log("hire-ready", "Checking", { candidateName, candidateEmail });

  // HIBP check
  let breachCount = 0;
  let breachSources: string[] = [];
  try {
    const res = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(candidateEmail)}?truncateResponse=false`, {
      headers: { "hibp-api-key": HIBP_API_KEY, "User-Agent": "DetroitWebAgency" },
    });
    if (res.status === 200) {
      const breaches = await res.json();
      breachCount = breaches.length;
      breachSources = breaches.slice(0, 5).map((b: { Name: string }) => b.Name);
    } else if (res.status !== 404) await res.text();
  } catch { /* skip */ }

  // NPI check (if healthcare trade)
  let npiInfo = "";
  const healthcareRoles = ["cna", "rn", "lpn", "nurse", "home_health"];
  if (healthcareRoles.some(r => trade.toLowerCase().includes(r))) {
    try {
      const npiRes = await fetch(`https://npiregistry.cms.hhs.gov/api/?version=2.1&first_name=${encodeURIComponent(candidateName.split(" ")[0])}&last_name=${encodeURIComponent(candidateName.split(" ").slice(1).join(" "))}&state=MI&limit=5`);
      const npiData = await npiRes.json();
      if (npiData.result_count > 0) {
        const r = npiData.results[0];
        const taxonomy = r.taxonomies?.[0]?.desc || "Unknown";
        npiInfo = `NPI: ${r.number} — ${taxonomy}`;
      }
    } catch { /* skip */ }
  }

  const html = wrap(`📋 Hire-Ready Report: ${candidateName}`, `
    <p style="color:#94a3b8">Trade: <strong style="color:#f1f5f9">${trade}</strong></p>
    <div class="card">
      <h2 style="margin-top:0">🔒 Credential Security</h2>
      <p>Email <strong>${candidateEmail}</strong> appears in <strong style="color:${breachCount > 0 ? '#f87171' : '#4ade80'}">${breachCount}</strong> known data breaches.</p>
      ${breachSources.length > 0 ? `<p style="color:#94a3b8;font-size:12px">Sources: ${breachSources.join(", ")}</p>` : ''}
      <p style="color:#94a3b8;font-size:12px">${breachCount === 0 ? '✅ Clean record — no known credential exposure.' : '⚠️ This candidate may have compromised credentials. Recommend mandatory password reset on onboarding.'}</p>
    </div>
    ${npiInfo ? `<div class="card"><h2 style="margin-top:0">🏥 License Verification</h2><p style="color:#4ade80">${npiInfo}</p></div>` : ''}
    <div class="card">
      <h2 style="margin-top:0">💡 Hiring Recommendation</h2>
      <p>${breachCount === 0 ? '✅ No red flags detected. Proceed with standard interview process.' : breachCount <= 2 ? '⚠️ Minor credential exposure. Not disqualifying but require password hygiene training.' : '🔴 Significant credential exposure. Implement enhanced security onboarding.'}</p>
    </div>
    <div class="card" style="text-align:center">
      <p style="color:#00d4ff">Need ongoing candidate monitoring? TechAlert ($99/mo) scans for available licensed tradespeople daily.</p>
    </div>
  `);

  await sendEmail(email, `📋 Hire-Ready Report: ${candidateName} — ${breachCount} breaches found`, html);
  return { breachCount, hasNPI: !!npiInfo };
}

// ════════════════════════════════════════════════════════════════════════════
// PRODUCT 8: "Storm Damage Lead Pack" ($99) — NOAA + local biz data
// ════════════════════════════════════════════════════════════════════════════
async function stormLeadPack(email: string, zipCode: string, trade: string) {
  log("storm", "Generating", { zipCode, trade });

  // Get recent severe weather alerts for the area
  const NOAA_API_KEY = Deno.env.get("NOAA_API_KEY") || "";
  let alerts: Array<{ headline: string; description: string; severity: string }> = [];
  try {
    const res = await fetch(`https://api.weather.gov/alerts/active?area=MI&severity=Severe,Extreme`, {
      headers: { "User-Agent": "DetroitWebAgency", Accept: "application/geo+json" },
    });
    const data = await res.json();
    alerts = (data.features || []).slice(0, 5).map((f: { properties: { headline: string; description: string; severity: string } }) => ({
      headline: f.properties.headline,
      description: f.properties.description?.slice(0, 200) || "",
      severity: f.properties.severity,
    }));
  } catch { /* skip */ }

  const html = wrap(`🌪️ Storm Damage Lead Intelligence`, `
    <p style="color:#94a3b8">Area: <strong style="color:#f1f5f9">${zipCode}</strong> — Trade: <strong style="color:#f1f5f9">${trade}</strong></p>
    <div class="card">
      <h2 style="margin-top:0">⚠️ Active Weather Alerts (Michigan)</h2>
      ${alerts.length > 0 ? alerts.map(a => `<div style="padding:8px 0;border-bottom:1px solid #334155">
        <p style="color:#fbbf24;font-weight:600;margin:0">${a.headline}</p>
        <p style="color:#94a3b8;font-size:12px;margin:4px 0 0">${a.description}</p>
      </div>`).join("") : '<p style="color:#4ade80">No severe weather alerts currently active in Michigan. Lead packs are generated after storm events.</p>'}
    </div>
    <div class="card">
      <h2 style="margin-top:0">How Storm Lead Packs Work</h2>
      <ul style="margin:0;padding-left:20px;line-height:1.8;color:#94a3b8">
        <li>When severe weather hits your area, we compile affected-area property data</li>
        <li>You receive 10 targeted leads within 24 hours of a qualifying event</li>
        <li>Each lead includes property address, owner contact info, and damage likelihood</li>
        <li>First-mover advantage: you contact homeowners before competitors</li>
      </ul>
    </div>
    <div class="card" style="text-align:center">
      <p style="color:#00d4ff">For automated storm alerts, check out our Storm Damage Lead Blaster ($29/mo) — instant notifications when storms hit your service area.</p>
    </div>
  `);

  await sendEmail(email, `🌪️ Storm Lead Intelligence: ${alerts.length} active alerts in Michigan`, html);
  return { alerts: alerts.length };
}

// ════════════════════════════════════════════════════════════════════════════
// PRODUCT 9: "Weekly Website Checkup" ($9.99/mo) — same as speed but positioned as recurring
// ════════════════════════════════════════════════════════════════════════════
// Uses same logic as isMyWebsiteFast — just called on a schedule

// ════════════════════════════════════════════════════════════════════════════
// PRODUCT 10: "My Digital Footprint" ($19.99) — comprehensive personal audit
// ════════════════════════════════════════════════════════════════════════════
async function myDigitalFootprint(email: string, targetEmail: string, fullName: string) {
  log("footprint", "Scanning", { targetEmail, fullName });

  // HIBP - all breaches
  let breaches: Array<{ Name: string; BreachDate: string; DataClasses: string[]; Domain: string }> = [];
  try {
    const res = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(targetEmail)}?truncateResponse=false`, {
      headers: { "hibp-api-key": HIBP_API_KEY, "User-Agent": "DetroitWebAgency" },
    });
    if (res.status === 200) breaches = await res.json();
    else if (res.status !== 404) await res.text();
  } catch { /* skip */ }

  // HIBP - pastes
  let pasteCount = 0;
  try {
    await new Promise(r => setTimeout(r, 1600));
    const pRes = await fetch(`https://haveibeenpwned.com/api/v3/pasteaccount/${encodeURIComponent(targetEmail)}`, {
      headers: { "hibp-api-key": HIBP_API_KEY, "User-Agent": "DetroitWebAgency" },
    });
    if (pRes.status === 200) {
      const pastes = await pRes.json();
      pasteCount = pastes.length;
    } else if (pRes.status !== 404) await pRes.text();
  } catch { /* skip */ }

  // Categorize exposed data
  const allDataClasses = new Set<string>();
  for (const b of breaches) for (const dc of b.DataClasses) allDataClasses.add(dc);

  const hasPasswords = allDataClasses.has("Passwords");
  const hasPhones = allDataClasses.has("Phone numbers");
  const hasAddresses = allDataClasses.has("Physical addresses");
  const hasFinancial = [...allDataClasses].some(dc => dc.toLowerCase().includes("credit") || dc.toLowerCase().includes("bank"));

  let breachTable = "";
  for (const b of breaches.slice(0, 10)) {
    breachTable += `<tr><td style="color:#f1f5f9">${b.Name}</td><td>${b.BreachDate}</td><td style="font-size:11px;color:#94a3b8">${b.DataClasses.slice(0, 3).join(", ")}</td></tr>`;
  }

  const html = wrap(`🌐 Digital Footprint Report`, `
    <p style="color:#94a3b8">Report for <strong style="color:#f1f5f9">${fullName}</strong> (${targetEmail})</p>
    <div style="display:flex;gap:16px;margin:16px 0;flex-wrap:wrap">
      <div class="card" style="flex:1;min-width:120px;text-align:center">
        <p style="color:#94a3b8;margin:0 0 8px">Breaches</p>
        <div class="score" style="color:${breaches.length > 0 ? '#f87171' : '#4ade80'};font-size:36px">${breaches.length}</div>
      </div>
      <div class="card" style="flex:1;min-width:120px;text-align:center">
        <p style="color:#94a3b8;margin:0 0 8px">Paste Dumps</p>
        <div class="score" style="color:${pasteCount > 0 ? '#fbbf24' : '#4ade80'};font-size:36px">${pasteCount}</div>
      </div>
      <div class="card" style="flex:1;min-width:120px;text-align:center">
        <p style="color:#94a3b8;margin:0 0 8px">Data Types</p>
        <div class="score" style="color:#00d4ff;font-size:36px">${allDataClasses.size}</div>
      </div>
    </div>
    <h2>Exposure Summary</h2>
    <div class="card">
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${hasPasswords ? '<span class="badge red">🔑 Passwords Exposed</span>' : ''}
        ${hasPhones ? '<span class="badge orange">📱 Phone Numbers Exposed</span>' : ''}
        ${hasAddresses ? '<span class="badge orange">📍 Physical Addresses Exposed</span>' : ''}
        ${hasFinancial ? '<span class="badge red">💳 Financial Data Exposed</span>' : ''}
        ${!hasPasswords && !hasPhones && !hasAddresses && !hasFinancial && breaches.length > 0 ? '<span class="badge yellow">📧 Email & Basic Info Exposed</span>' : ''}
        ${breaches.length === 0 ? '<span class="badge green">✅ No Known Exposures</span>' : ''}
      </div>
    </div>
    ${breachTable ? `<h2>Breach History</h2><div class="card"><table><tr><th>Source</th><th>Date</th><th>Data</th></tr>${breachTable}</table>${breaches.length > 10 ? `<p style="color:#94a3b8;font-size:11px;margin-top:8px">+ ${breaches.length - 10} more breaches</p>` : ''}</div>` : ''}
    <h2>Action Plan</h2>
    <div class="card">
      <ol style="margin:0;padding-left:20px;line-height:1.8">
        ${hasPasswords ? '<li style="color:#f87171"><strong>URGENT:</strong> Change passwords on all breached accounts immediately</li>' : ''}
        <li>Enable two-factor authentication on email, banking, and social media</li>
        <li>Use unique passwords — never reuse across sites</li>
        ${hasPhones ? '<li>Be cautious of unsolicited calls/texts — your phone number is in circulation</li>' : ''}
        ${hasAddresses ? '<li>Consider a PO Box for sensitive mail — your physical address has been exposed</li>' : ''}
        <li>Set up Google Alerts for your name to catch new exposures</li>
      </ol>
    </div>
    <div class="card" style="text-align:center">
      <p style="color:#00d4ff">Want ongoing monitoring? Our Dark Web Monitor ($49/mo) scans for new breaches weekly and alerts you immediately.</p>
    </div>
  `);

  await sendEmail(email, `🌐 Digital Footprint: ${breaches.length} breaches, ${pasteCount} paste dumps found`, html);
  return { breaches: breaches.length, pastes: pasteCount, dataTypes: allDataClasses.size };
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN ROUTER
// ════════════════════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { product, email } = body;

    if (!product || !email) {
      return new Response(JSON.stringify({ error: "product and email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: unknown;

    switch (product) {
      case "am_i_breached":
        result = await amIBreached(email, body.target_email || email);
        break;
      case "website_speed":
        result = await isMyWebsiteFast(email, body.url || "");
        break;
      case "google_me":
        result = await googleMe(email, body.business_name || "", body.city || "");
        break;
      case "shield_my_team":
        result = await shieldMyTeam(email, body.company_name || "", body.emails || []);
        break;
      case "spy_competitor":
        result = await spyOnCompetitor(email, body.your_business || "", body.competitor_url || "");
        break;
      case "review_my_reviews":
        result = await reviewMyReviews(email, body.business_name || "", body.city || "");
        break;
      case "hire_ready":
        result = await hireReadyReport(email, body.candidate_name || "", body.candidate_email || "", body.trade || "");
        break;
      case "storm_leads":
        result = await stormLeadPack(email, body.zip_code || "", body.trade || "");
        break;
      case "weekly_checkup":
        result = await isMyWebsiteFast(email, body.url || "");
        break;
      case "digital_footprint":
        result = await myDigitalFootprint(email, body.target_email || email, body.full_name || "");
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown product: ${product}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    log(product, "Complete", result);
    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[COLD-SELL] Error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
