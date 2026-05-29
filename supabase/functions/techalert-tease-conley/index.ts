import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPANY_SIGNALS = [
  "inc", "llc", "corp", "co.", "company", "contractors", "services", "solutions",
  "group", "enterprises", "associates", "systems", "industries", "construction",
  "plumbing", "hvac", "mechanical", "electric", "heating", "cooling", "dba",
  "d/b/a", "comfort", "zone", "supreme", "keitz", "marvin", "appliance",
  "supply", "maintenance", "management", "properties",
];
const COMPANY_WORD_BOUNDARY = /\b(and|son|sons|brothers|bros)\b/i;

function isPersonName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;
  if (COMPANY_SIGNALS.some((s) => lower.includes(s))) return false;
  if (COMPANY_WORD_BOUNDARY.test(lower)) return false;
  if (name === name.toUpperCase() && name.length > 8) return false;
  if (name.includes("&")) return false;
  if (lower.endsWith(" and")) return false;
  return true;
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function scoreBadge(score: number): { emoji: string; label: string; bg: string; color: string } {
  if (score >= 8) return { emoji: "🟢", label: "High Availability", bg: "#064e3b", color: "#34d399" };
  if (score >= 5) return { emoji: "🟡", label: "Possible", bg: "#451a03", color: "#fbbf24" };
  return { emoji: "🔵", label: "Monitor", bg: "#1e3a5f", color: "#60a5fa" };
}

function renderRichCard(c: any, i: number): string {
  const name = titleCase(c.full_name || c.name || "Unknown");
  const license = c.license_type || "Boiler Operator";
  const licNum = c.license_number || "On File";
  const city = c.city === "true" || c.city === true ? "Metro Detroit" : (c.city || "Michigan");
  const score = c.score || 5;
  const badge = scoreBadge(score);
  const employer = c.current_employer || null;
  const experience = c.years_experience ? `${c.years_experience}+ yrs` : null;
  const quals = c.qualifications_summary || null;
  const recommendation = c.hiring_recommendation || null;
  const scoreReason = c.score_reason || null;
  const licenseExpiry = c.license_expiry || null;
  const checkoutUrl = "https://www.detroitwebagent.com/hire-alert";

  return `
  <tr><td style="padding:10px 0">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#111d2e;border:1px solid rgba(0,212,255,0.2);border-radius:12px;overflow:hidden">
      <tr><td style="padding:20px 24px">
        <table width="100%" cellpadding="0" cellspacing="0">
          <!-- Header Row -->
          <tr>
            <td style="vertical-align:top;width:40px">
              <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#00d4ff,#0066ff);color:#fff;font-size:16px;font-weight:800;line-height:40px;text-align:center">${i + 1}</div>
            </td>
            <td style="padding-left:16px;vertical-align:top">
              <div style="color:#ffffff;font-size:17px;font-weight:800;margin-bottom:4px">${name}</div>
              <div style="color:#00d4ff;font-size:13px;font-weight:600;margin-bottom:8px">🔧 ${license}</div>
              
              <!-- Availability Badge -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:10px">
                <tr><td style="background:${badge.bg};border-radius:6px;padding:4px 12px">
                  <span style="color:${badge.color};font-size:11px;font-weight:700">${badge.emoji} ${badge.label} (${score}/10)</span>
                </td></tr>
              </table>
              
              <!-- Details Grid -->
              <table cellpadding="0" cellspacing="0" style="font-size:12px;color:rgba(255,255,255,0.65);width:100%">
                <tr><td style="padding:3px 0">📍 ${city}</td></tr>
                <tr><td style="padding:3px 0">📋 License #: ${licNum}${licenseExpiry ? ` · Exp: ${licenseExpiry}` : ""}</td></tr>
                ${employer ? `<tr><td style="padding:3px 0">🏢 Current: <strong style="color:#fff">${employer}</strong></td></tr>` : ""}
                ${experience ? `<tr><td style="padding:3px 0">⏱️ ${experience} experience</td></tr>` : ""}
              </table>
            </td>
          </tr>
        </table>
        
        ${quals ? `
        <!-- Qualifications Summary -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">
          <tr><td style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:8px;padding:12px 16px">
            <div style="color:#34d399;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">AI QUALIFICATIONS ASSESSMENT</div>
            <div style="color:rgba(255,255,255,0.75);font-size:12px;line-height:1.6">${quals}</div>
          </td></tr>
        </table>` : ""}
        
        ${recommendation ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">
          <tr><td style="background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.15);border-radius:8px;padding:12px 16px">
            <div style="color:#00d4ff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">RECOMMENDATION</div>
            <div style="color:rgba(255,255,255,0.75);font-size:12px;line-height:1.6">${recommendation}</div>
          </td></tr>
        </table>` : ""}

        ${scoreReason ? `
        <div style="color:rgba(255,255,255,0.4);font-size:11px;font-style:italic;margin-top:8px">💡 ${scoreReason}</div>` : ""}
        
        <!-- Action Buttons -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px">
          <tr>
            <td style="width:50%;padding-right:6px">
              <a href="${checkoutUrl}" style="display:block;background:linear-gradient(135deg,#00d4ff,#0066ff);color:#fff;font-size:12px;font-weight:700;padding:10px 0;border-radius:8px;text-decoration:none;text-align:center">⚡ Unlock All Candidates</a>
            </td>
            <td style="width:50%;padding-left:6px">
              <a href="https://detroitwebagent.com/talent-radar/dashboard?token=DEMO" style="display:block;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:#fff;font-size:12px;font-weight:700;padding:10px 0;border-radius:8px;text-decoration:none;text-align:center">📊 See Live Dashboard</a>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>`;
}

function renderBlurredCard(c: any): string {
  const license = c.license_type || "Boiler Operator";
  const city = c.city === "true" || c.city === true ? "Metro Detroit" : (c.city || "Michigan");
  return `
  <tr><td style="padding:4px 0">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#111d2e;border:1px solid rgba(255,255,255,0.05);border-radius:8px;overflow:hidden;opacity:0.5">
      <tr><td style="padding:10px 16px">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:middle">
              <span style="color:rgba(255,255,255,0.3);font-size:13px;font-weight:600;letter-spacing:2px">████ ██████</span>
              <span style="color:rgba(0,212,255,0.4);font-size:11px;margin-left:12px">🔧 ${license}</span>
              <span style="color:rgba(255,255,255,0.25);font-size:11px;margin-left:12px">📍 ${city}</span>
            </td>
            <td style="text-align:right">
              <span style="background:rgba(0,212,255,0.1);color:rgba(0,212,255,0.4);font-size:9px;padding:3px 8px;border-radius:4px;text-transform:uppercase;letter-spacing:1px">🔒 Locked</span>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to_email, preview } = await req.json();
    const recipientEmail = to_email || "matt@detroitwebagent.com";

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: candidates, error } = await sb
      .from("hire_alert_candidates")
      .select("full_name, name, license_type, license_number, license_expiry, city, score, source, current_employer, years_experience, score_reason, qualifications_summary, hiring_recommendation, created_at, status, is_company_name")
      .or("license_type.ilike.%boiler%,trade.ilike.%boiler%")
      .neq("status", "quarantined")
      .neq("is_company_name", true)
      .order("score", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Double-check with isPersonName filter
    const cleanCandidates = (candidates || []).filter((c: any) => {
      const displayName = c.full_name || c.name || "";
      return displayName.trim().length > 0 && isPersonName(displayName);
    });

    if (cleanCandidates.length === 0) {
      return new Response(JSON.stringify({ error: "No boiler candidates found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalCount = cleanCandidates.length;
    const revealed = cleanCandidates.slice(0, 10);
    const blurred = cleanCandidates.slice(10);
    const blurredCount = blurred.length;

    const revealedCards = revealed.map((c: any, i: number) => renderRichCard(c, i)).join("");
    const blurredCards = blurred.map((c: any) => renderBlurredCard(c)).join("");

    const checkoutUrl = "https://www.detroitwebagent.com/hire-alert";

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:640px;margin:0 auto;background:#0a1628">

  <!-- Header -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0a1628,#0f2440)">
    <tr><td style="padding:40px 30px 20px">
      <div style="color:#00d4ff;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px">⚡ TECHALERT INTELLIGENCE REPORT</div>
      <div style="color:#ffffff;font-size:26px;font-weight:800;line-height:1.2;margin-bottom:6px">${totalCount} Licensed Boiler Operators</div>
      <div style="color:rgba(255,255,255,0.5);font-size:14px">Identified in Metro Detroit — ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
    </td></tr>
  </table>

  <!-- What You're Looking At -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:24px 30px 0">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0d2137,#132d47);border:1px solid rgba(0,212,255,0.15);border-radius:12px">
        <tr><td style="padding:20px 24px">
          <div style="color:#00d4ff;font-size:13px;font-weight:700;margin-bottom:10px">🎯 WHAT YOU'RE LOOKING AT</div>
          <div style="color:rgba(255,255,255,0.75);font-size:13px;line-height:1.7">
            This is a <strong style="color:#fff">live intelligence feed</strong> of every licensed boiler operator we've identified in the Metro Detroit area. These are <strong style="color:#fff">real people</strong> — verified professionals pulled from <strong style="color:#fff">Michigan's state licensing database (MIOSHA/LARA)</strong>.
            <br><br>
            What makes TechAlert powerful:
          </div>
          <table cellpadding="0" cellspacing="0" style="margin-top:12px;font-size:12px;color:rgba(255,255,255,0.7)">
            <tr><td style="padding:6px 0;vertical-align:top">🆕</td><td style="padding:6px 0 6px 8px"><strong style="color:#fff">Newly Licensed Operators</strong> — We detect the moment a new boiler license is issued. First company to reach out wins.</td></tr>
            <tr><td style="padding:6px 0;vertical-align:top">🔄</td><td style="padding:6px 0 6px 8px"><strong style="color:#fff">License Status Changes</strong> — Renewals, expirations, and lapses are tracked. An expired license often means a tech is between jobs.</td></tr>
            <tr><td style="padding:6px 0;vertical-align:top">📡</td><td style="padding:6px 0 6px 8px"><strong style="color:#fff">Multi-Source Cross-Reference</strong> — License data is enriched with employment signals from professional networks, job boards, and industry databases.</td></tr>
            <tr><td style="padding:6px 0;vertical-align:top">🤖</td><td style="padding:6px 0 6px 8px"><strong style="color:#fff">AI Availability Scoring</strong> — Each candidate gets a 1-10 score based on hiring signals. 🟢 High = likely available now. 🟡 Possible = worth checking. 🔵 Monitor = keep on radar.</td></tr>
            <tr><td style="padding:6px 0;vertical-align:top">⚡</td><td style="padding:6px 0 6px 8px"><strong style="color:#fff">Daily Scanning</strong> — Not a static database. TechAlert scans every single day, so you see new candidates before your competitors.</td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>

  <!-- Revenue Impact -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:16px 30px 0">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a0a0a;border:1px solid rgba(255,80,80,0.2);border-radius:12px">
        <tr><td style="padding:16px 20px">
          <div style="color:#ff6b6b;font-size:12px;font-weight:700;margin-bottom:6px">🏭 THE COST OF NOT KNOWING</div>
          <div style="color:rgba(255,255,255,0.7);font-size:12px;line-height:1.6">
            A single boiler tech generates <strong style="color:#fff">$150K–$250K/year in revenue</strong>. If you lose one to a competitor — or miss a newly-licensed operator entering the market — that's real revenue gone. TechAlert makes sure you see them <strong style="color:#fff">first</strong>.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>

  <!-- Stat Bar -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:20px 30px">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#111d2e;border-radius:12px;border:1px solid rgba(255,255,255,0.08)">
        <tr>
          <td style="padding:16px;text-align:center;width:33%;border-right:1px solid rgba(255,255,255,0.06)">
            <div style="color:#00d4ff;font-size:28px;font-weight:800">${totalCount}</div>
            <div style="color:rgba(255,255,255,0.4);font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-top:2px">Total Found</div>
          </td>
          <td style="padding:16px;text-align:center;width:33%;border-right:1px solid rgba(255,255,255,0.06)">
            <div style="color:#10b981;font-size:28px;font-weight:800">10</div>
            <div style="color:rgba(255,255,255,0.4);font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-top:2px">Preview</div>
          </td>
          <td style="padding:16px;text-align:center;width:33%">
            <div style="color:#f59e0b;font-size:28px;font-weight:800">${blurredCount}</div>
            <div style="color:rgba(255,255,255,0.4);font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-top:2px">🔒 Locked</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>

  <!-- Revealed Section Header -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:0 30px 8px">
      <div style="color:#10b981;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">✅ SAMPLE — 10 OF ${totalCount} CANDIDATES</div>
      <div style="color:rgba(255,255,255,0.4);font-size:11px;margin-top:4px">Each card shows AI-assessed qualifications, availability score, and license details</div>
    </td></tr>
  </table>

  <!-- Revealed Cards -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:0 30px">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${revealedCards}
      </table>
    </td></tr>
  </table>

  <!-- Paywall Divider -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:24px 30px">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#1a1005,#261a08);border:2px solid rgba(245,158,11,0.3);border-radius:12px">
        <tr><td style="padding:20px 24px;text-align:center">
          <div style="color:#f59e0b;font-size:24px;margin-bottom:6px">🔒</div>
          <div style="color:#f59e0b;font-size:16px;font-weight:800;margin-bottom:4px">${blurredCount} More Candidates Locked</div>
          <div style="color:rgba(255,255,255,0.5);font-size:12px;line-height:1.5">Full names, contact info, AI qualifications, availability scores,<br>and one-click outreach tools — all available with TechAlert.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>

  <!-- Blurred Cards -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:0 30px">
      <div style="color:rgba(255,255,255,0.3);font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">🔒 LOCKED CANDIDATES — SUBSCRIBE TO UNLOCK</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${blurredCards}
      </table>
    </td></tr>
  </table>

  <!-- What You Get Section -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:24px 30px">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0d2137,#132d47);border:1px solid rgba(0,212,255,0.15);border-radius:12px">
        <tr><td style="padding:20px 24px">
          <div style="color:#00d4ff;font-size:13px;font-weight:700;margin-bottom:12px">🎁 WHAT YOU GET ON DAY 1</div>
          <table cellpadding="0" cellspacing="0" style="font-size:12px;color:rgba(255,255,255,0.7);line-height:1.6">
            <tr><td style="padding:4px 0;color:#10b981">✓</td><td style="padding:4px 0 4px 8px">Full access to all ${totalCount}+ candidates with names & contact info</td></tr>
            <tr><td style="padding:4px 0;color:#10b981">✓</td><td style="padding:4px 0 4px 8px">Live dashboard with search, filters, and CSV export</td></tr>
            <tr><td style="padding:4px 0;color:#10b981">✓</td><td style="padding:4px 0 4px 8px">⚡ 48-hour exclusive claim system — lock a candidate before competitors see them</td></tr>
            <tr><td style="padding:4px 0;color:#10b981">✓</td><td style="padding:4px 0 4px 8px">✍️ AI-generated outreach drafts (SMS + email) with one click</td></tr>
            <tr><td style="padding:4px 0;color:#10b981">✓</td><td style="padding:4px 0 4px 8px">🗓️ Fast-Track Interview — send booking link to a candidate via SMS instantly</td></tr>
            <tr><td style="padding:4px 0;color:#10b981">✓</td><td style="padding:4px 0 4px 8px">Daily alerts when new high-scoring candidates appear</td></tr>
            <tr><td style="padding:4px 0;color:#10b981">✓</td><td style="padding:4px 0 4px 8px">Market signals feed showing local hiring patterns & expansion news</td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>

  <!-- CTA -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:8px 30px 32px;text-align:center">
      <div style="color:rgba(255,255,255,0.5);font-size:13px;margin-bottom:16px">Stop losing techs to companies who find them first.</div>
      <a href="${checkoutUrl}" style="display:inline-block;background:linear-gradient(135deg,#00d4ff,#0066ff);color:#fff;font-size:16px;font-weight:800;padding:16px 40px;border-radius:10px;text-decoration:none;letter-spacing:0.5px">Unlock All ${totalCount} Candidates →</a>
      <div style="color:rgba(255,255,255,0.35);font-size:11px;margin-top:12px">Starting at $99/mo · Cancel anytime · First 10 clients get grandfathered pricing</div>
    </td></tr>
  </table>

  <!-- How It Works -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:0 30px 30px">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#111d2e;border:1px solid rgba(255,255,255,0.06);border-radius:12px">
        <tr><td style="padding:20px 24px">
          <div style="color:#00d4ff;font-size:12px;font-weight:700;margin-bottom:12px">HOW TECHALERT WORKS</div>
          <table cellpadding="0" cellspacing="0" style="font-size:12px;color:rgba(255,255,255,0.6);line-height:1.6">
            <tr><td style="padding:4px 0;vertical-align:top;color:#00d4ff;font-weight:700;width:20px">1.</td><td style="padding:4px 0">We scan Michigan's MIOSHA/LARA licensing database <strong style="color:#fff">every day</strong></td></tr>
            <tr><td style="padding:4px 0;vertical-align:top;color:#00d4ff;font-weight:700">2.</td><td style="padding:4px 0">New licenses, renewals, expirations, and status changes are flagged</td></tr>
            <tr><td style="padding:4px 0;vertical-align:top;color:#00d4ff;font-weight:700">3.</td><td style="padding:4px 0">AI assesses each candidate's availability and generates qualifications summary</td></tr>
            <tr><td style="padding:4px 0;vertical-align:top;color:#00d4ff;font-weight:700">4.</td><td style="padding:4px 0">You get <strong style="color:#fff">instant alerts</strong> when a high-value candidate appears — before any recruiter sees them</td></tr>
            <tr><td style="padding:4px 0;vertical-align:top;color:#00d4ff;font-weight:700">5.</td><td style="padding:4px 0">Claim, draft outreach, or fast-track an interview — all from your dashboard</td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>

  <!-- Footer -->
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:20px 30px 40px;text-align:center">
      <div style="color:rgba(255,255,255,0.2);font-size:10px;line-height:1.6">
        Detroit Web Agent · TechAlert Hiring Intelligence<br>
        matt@detroitwebagent.com · (313) 992-1219
      </div>
    </td></tr>
  </table>

</div>
</body></html>`;

    if (preview) {
      return new Response(JSON.stringify({ html, total: totalCount, revealed: 10, blurred: blurredCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send via Resend
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "Matt Michels <matt@detroitwebagent.com>",
        to: [recipientEmail],
        subject: `🔧 ${totalCount} Licensed Boiler Operators Found in Metro Detroit — TechAlert Intel`,
        html,
      }),
    });

    const emailData = await emailRes.json();
    console.log("[techalert-tease] Email sent:", JSON.stringify(emailData));

    return new Response(JSON.stringify({ success: true, sent_to: recipientEmail, total: totalCount, revealed: 10, blurred: blurredCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[techalert-tease] Error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
