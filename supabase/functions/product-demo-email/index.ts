import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { to_email, company_name, contact_name } = await req.json();
    const email = to_email || "matt@detroitwebagent.com";
    const company = company_name || "Your Company";
    const contact = contact_name || "there";

    // Fetch real boiler candidates
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: candidates } = await sb
      .from("hire_alert_candidates")
      .select("name, license_type, license_number, city, source, current_employer, years_experience, score")
      .or("license_type.ilike.%boiler%,trade.ilike.%boiler%")
      .order("score", { ascending: false })
      .limit(80);

    const allCandidates = candidates || [];
    const revealed = allCandidates.slice(0, 10);
    const blurred = allCandidates.slice(10);
    const totalCount = allCandidates.length;

    // Build candidate cards
    function renderFullCard(c: any, i: number): string {
      const name = titleCase(c.name || "Unknown");
      const license = c.license_type || "Boiler Operator";
      const licNum = c.license_number || "On File";
      const city = c.city === "true" || c.city === true ? "Metro Detroit" : (c.city || "Michigan");
      const source = c.source === "miosha" ? "MIOSHA" : (c.source || "State Registry");
      return `
      <tr><td style="padding:6px 0">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#111d2e;border:1px solid rgba(0,212,255,0.2);border-radius:10px">
          <tr><td style="padding:14px 18px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:top;width:32px">
                  <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#00d4ff,#0066ff);color:#fff;font-size:13px;font-weight:700;line-height:32px;text-align:center">${i+1}</div>
                </td>
                <td style="padding-left:12px;vertical-align:top">
                  <div style="color:#fff;font-size:14px;font-weight:700;margin-bottom:3px">${name}</div>
                  <div style="color:#00d4ff;font-size:11px;font-weight:600;margin-bottom:4px">🔧 ${license}</div>
                  <div style="font-size:11px;color:rgba(255,255,255,0.5)">📍 ${city} · 📋 #${licNum} · 🏛️ ${source}</div>
                  ${c.current_employer ? `<div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px">🏢 ${c.current_employer}</div>` : ""}
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>`;
    }

    function renderBlurredCard(): string {
      return `
      <tr><td style="padding:3px 0">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#111d2e;border:1px solid rgba(255,255,255,0.05);border-radius:8px">
          <tr><td style="padding:10px 18px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;width:32px">
                  <div style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.15);font-size:13px;line-height:32px;text-align:center">🔒</div>
                </td>
                <td style="padding-left:12px;vertical-align:middle">
                  <div style="color:rgba(255,255,255,0.15);font-size:13px;font-weight:700;filter:blur(4px)">████ ████████</div>
                  <div style="color:rgba(0,212,255,0.15);font-size:11px;filter:blur(3px);margin-top:2px">Boiler Operator · Metro Detroit</div>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </td></tr>`;
    }

    const revealedHTML = revealed.map((c, i) => renderFullCard(c, i)).join("");
    const blurredHTML = blurred.slice(0, 30).map(() => renderBlurredCard()).join("");

    // Demo job data for FieldDesk
    const demoJobs = [
      { tech: "Mike J.", type: "Boiler Install", addr: "14200 E Jefferson, Detroit", status: "En Route", color: "#00d4ff" },
      { tech: "Carlos R.", type: "Boiler Repair", addr: "22100 Moross Rd, Detroit", status: "On Site", color: "#10b981" },
      { tech: "James W.", type: "Annual Inspection", addr: "1 Energy Plaza, Detroit", status: "Completed", color: "#6b7280" },
      { tech: "Dave K.", type: "Emergency Repair", addr: "400 Monroe St, Detroit", status: "Dispatched", color: "#f59e0b" },
    ];

    const jobRows = demoJobs.map(j => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.05);color:#fff;font-size:12px;font-weight:600">${j.tech}</td>
        <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.05);color:rgba(255,255,255,0.6);font-size:12px">${j.type}</td>
        <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.05);color:rgba(255,255,255,0.4);font-size:11px">${j.addr}</td>
        <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center">
          <span style="display:inline-block;padding:3px 10px;border-radius:12px;background:${j.color}22;color:${j.color};font-size:10px;font-weight:700">${j.status}</span>
        </td>
      </tr>
    `).join("");

    // Visitor intelligence demo
    const visitors = [
      { company: "Stellantis", page: "/boiler-service", visits: 4, value: "$85K" },
      { company: "Detroit Medical Center", page: "/emergency-repair", visits: 7, value: "$120K" },
      { company: "Wayne County Schools", page: "/annual-inspections", visits: 3, value: "$45K" },
    ];
    const visitorRows = visitors.map(v => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.05);color:#fff;font-size:13px;font-weight:600">${v.company}</td>
        <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.05);color:rgba(255,255,255,0.5);font-size:12px">${v.page}</td>
        <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.05);color:#00d4ff;font-size:12px;text-align:center">${v.visits}</td>
        <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.05);color:#10b981;font-size:13px;font-weight:700;text-align:right">${v.value}</td>
      </tr>
    `).join("");

    // Feature comparison
    const features = [
      ["Live Dispatch Board", true, false],
      ["GPS Tech Tracking Map", true, false],
      ["Mobile Tech App (PIN Login)", true, false],
      ["Auto-SMS Notifications", true, false],
      ["Photo Documentation", true, true],
      ["Visitor Intelligence (SiteRadar)", true, false],
      ["Predictive Hiring (TechAlert)", true, false],
      ["Works on Phones in the Field", true, false],
    ];
    const featureRows = features.map(([name, us, them]) => `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);color:rgba(255,255,255,0.8);font-size:13px">${name}</td>
        <td style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;font-size:16px">${us ? "✅" : "❌"}</td>
        <td style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);text-align:center;font-size:16px">${them ? "✅" : "❌"}</td>
      </tr>
    `).join("");

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#050d1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#050d1a">
<tr><td align="center" style="padding:20px 10px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px">

<!-- HERO -->
<tr><td style="padding:40px 30px 30px;text-align:center;background:linear-gradient(180deg,#0a1628 0%,#0d1f38 100%);border-radius:16px 16px 0 0;border:1px solid rgba(0,212,255,0.15);border-bottom:none">
  <div style="font-size:11px;letter-spacing:3px;color:#00d4ff;font-weight:700;margin-bottom:12px">DETROIT WEB AGENCY</div>
  <div style="font-size:28px;font-weight:800;color:#ffffff;line-height:1.2;margin-bottom:8px">Your Field Operations,<br/>Reimagined.</div>
  <div style="font-size:15px;color:rgba(255,255,255,0.5);margin-bottom:6px">Hey ${contact} — here's what ${company} gets on day one.</div>
  <div style="width:60px;height:3px;background:linear-gradient(90deg,#00d4ff,#0066ff);margin:20px auto 0;border-radius:2px"></div>
</td></tr>

<!-- SECTION 1: FIELDDESK -->
<tr><td style="padding:30px 24px;background:#0a1628;border-left:1px solid rgba(0,212,255,0.15);border-right:1px solid rgba(0,212,255,0.15)">
  <div style="font-size:10px;letter-spacing:2px;color:#00d4ff;font-weight:700;margin-bottom:6px">01 — FIELDDESK COMMAND CENTER</div>
  <div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:4px">Dispatch. Track. Complete.</div>
  <div style="font-size:13px;color:rgba(255,255,255,0.45);margin-bottom:20px">Real-time visibility into every job, every tech, every minute.</div>

  <!-- Dispatch Board Mock -->
  <div style="background:#0d1f38;border:1px solid rgba(0,212,255,0.1);border-radius:10px;overflow:hidden;margin-bottom:16px">
    <div style="padding:10px 14px;background:rgba(0,212,255,0.05);border-bottom:1px solid rgba(0,212,255,0.1)">
      <span style="color:#00d4ff;font-size:11px;font-weight:700">📋 LIVE DISPATCH BOARD</span>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr style="background:rgba(255,255,255,0.03)">
        <td style="padding:8px 10px;color:rgba(255,255,255,0.3);font-size:10px;font-weight:700">TECH</td>
        <td style="padding:8px 10px;color:rgba(255,255,255,0.3);font-size:10px;font-weight:700">JOB</td>
        <td style="padding:8px 10px;color:rgba(255,255,255,0.3);font-size:10px;font-weight:700">ADDRESS</td>
        <td style="padding:8px 10px;color:rgba(255,255,255,0.3);font-size:10px;font-weight:700;text-align:center">STATUS</td>
      </tr>
      ${jobRows}
    </table>
  </div>

  <!-- Tech Map Mock -->
  <div style="background:#0d1f38;border:1px solid rgba(0,212,255,0.1);border-radius:10px;overflow:hidden;margin-bottom:16px">
    <div style="padding:10px 14px;background:rgba(0,212,255,0.05);border-bottom:1px solid rgba(0,212,255,0.1)">
      <span style="color:#00d4ff;font-size:11px;font-weight:700">🗺️ LIVE TECH MAP — Metro Detroit</span>
    </div>
    <div style="padding:24px;text-align:center;background:linear-gradient(135deg,#0a1a2e,#0d2440)">
      <div style="display:inline-block;position:relative;width:100%;max-width:400px">
        <div style="font-size:40px;letter-spacing:8px;margin-bottom:8px">📍📍📍📍</div>
        <div style="color:rgba(255,255,255,0.3);font-size:11px;margin-bottom:12px">4 techs active across Metro Detroit</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:11px">
          <tr>
            <td style="padding:4px;text-align:center"><span style="color:#00d4ff">●</span> <span style="color:rgba(255,255,255,0.5)">Mike — Grosse Pointe</span></td>
            <td style="padding:4px;text-align:center"><span style="color:#10b981">●</span> <span style="color:rgba(255,255,255,0.5)">Carlos — East Side</span></td>
          </tr>
          <tr>
            <td style="padding:4px;text-align:center"><span style="color:#6b7280">●</span> <span style="color:rgba(255,255,255,0.5)">James — Downtown</span></td>
            <td style="padding:4px;text-align:center"><span style="color:#f59e0b">●</span> <span style="color:rgba(255,255,255,0.5)">Dave — Dearborn</span></td>
          </tr>
        </table>
      </div>
    </div>
  </div>

  <!-- Mobile App Mock -->
  <div style="background:#0d1f38;border:1px solid rgba(0,212,255,0.1);border-radius:10px;overflow:hidden">
    <div style="padding:10px 14px;background:rgba(0,212,255,0.05);border-bottom:1px solid rgba(0,212,255,0.1)">
      <span style="color:#00d4ff;font-size:11px;font-weight:700">📱 MOBILE TECH APP</span>
    </div>
    <div style="padding:20px;text-align:center">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:33%;text-align:center;padding:8px">
            <div style="font-size:28px;margin-bottom:6px">🔑</div>
            <div style="color:#fff;font-size:11px;font-weight:700">4-Digit PIN</div>
            <div style="color:rgba(255,255,255,0.35);font-size:10px">No passwords. No email.</div>
          </td>
          <td style="width:33%;text-align:center;padding:8px">
            <div style="font-size:28px;margin-bottom:6px">📸</div>
            <div style="color:#fff;font-size:11px;font-weight:700">Photo Upload</div>
            <div style="color:rgba(255,255,255,0.35);font-size:10px">Before/after on every job.</div>
          </td>
          <td style="width:33%;text-align:center;padding:8px">
            <div style="font-size:28px;margin-bottom:6px">📲</div>
            <div style="color:#fff;font-size:11px;font-weight:700">Auto-SMS</div>
            <div style="color:rgba(255,255,255,0.35);font-size:10px">Customer notified at every step.</div>
          </td>
        </tr>
      </table>
    </div>
  </div>

  <!-- Auto SMS examples -->
  <div style="margin-top:16px;padding:16px;background:#111d2e;border-radius:10px;border:1px solid rgba(255,255,255,0.05)">
    <div style="color:rgba(255,255,255,0.3);font-size:10px;font-weight:700;letter-spacing:1px;margin-bottom:10px">AUTO-SMS TO HOMEOWNERS</div>
    <div style="background:#0a1628;border-radius:8px;padding:10px 14px;margin-bottom:8px;border-left:3px solid #00d4ff">
      <div style="color:rgba(255,255,255,0.7);font-size:12px">"Hi Mrs. Johnson — Mike from ${company} is en route and will arrive in ~15 minutes."</div>
    </div>
    <div style="background:#0a1628;border-radius:8px;padding:10px 14px;margin-bottom:8px;border-left:3px solid #10b981">
      <div style="color:rgba(255,255,255,0.7);font-size:12px">"Your boiler repair has been completed ✅ — here's a summary of work performed."</div>
    </div>
    <div style="background:#0a1628;border-radius:8px;padding:10px 14px;border-left:3px solid #f59e0b">
      <div style="color:rgba(255,255,255,0.7);font-size:12px">"Thanks for choosing ${company}! If you're happy, a quick Google review would mean a lot → [link]"</div>
    </div>
  </div>
</td></tr>

<!-- SECTION 2: SITERADAR -->
<tr><td style="padding:30px 24px;background:#0d1f38;border-left:1px solid rgba(0,212,255,0.15);border-right:1px solid rgba(0,212,255,0.15)">
  <div style="font-size:10px;letter-spacing:2px;color:#00d4ff;font-weight:700;margin-bottom:6px">02 — SITERADAR VISITOR INTELLIGENCE</div>
  <div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:4px">See Who's On Your Website Right Now</div>
  <div style="font-size:13px;color:rgba(255,255,255,0.45);margin-bottom:20px">Company-level identification. No login required from the visitor.</div>

  <div style="background:#0a1628;border:1px solid rgba(0,212,255,0.1);border-radius:10px;overflow:hidden">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr style="background:rgba(0,212,255,0.05)">
        <td style="padding:10px 12px;color:rgba(255,255,255,0.3);font-size:10px;font-weight:700">COMPANY</td>
        <td style="padding:10px 12px;color:rgba(255,255,255,0.3);font-size:10px;font-weight:700">PAGE</td>
        <td style="padding:10px 12px;color:rgba(255,255,255,0.3);font-size:10px;font-weight:700;text-align:center">VISITS</td>
        <td style="padding:10px 12px;color:rgba(255,255,255,0.3);font-size:10px;font-weight:700;text-align:right">EST. VALUE</td>
      </tr>
      ${visitorRows}
    </table>
  </div>
  <div style="text-align:center;padding:14px 0 0">
    <div style="color:rgba(255,255,255,0.3);font-size:11px">These companies visited your site but never called. Now you can call them first.</div>
  </div>
</td></tr>

<!-- SECTION 3: TECHALERT -->
<tr><td style="padding:30px 24px;background:#0a1628;border-left:1px solid rgba(0,212,255,0.15);border-right:1px solid rgba(0,212,255,0.15)">
  <div style="font-size:10px;letter-spacing:2px;color:#00d4ff;font-weight:700;margin-bottom:6px">03 — TECHALERT PREDICTIVE HIRING</div>
  <div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:4px">Know Before Anyone Else</div>
  <div style="font-size:13px;color:rgba(255,255,255,0.45);margin-bottom:20px">We monitor state license databases, job boards, and public records daily. When a licensed tech becomes available — or newly licensed — you're the first to know.</div>

  <!-- What you're looking at -->
  <div style="background:linear-gradient(135deg,rgba(0,212,255,0.08),rgba(0,102,255,0.05));border:1px solid rgba(0,212,255,0.15);border-radius:10px;padding:18px;margin-bottom:20px">
    <div style="color:#00d4ff;font-size:12px;font-weight:700;margin-bottom:8px">🧠 WHAT YOU'RE LOOKING AT</div>
    <div style="color:rgba(255,255,255,0.6);font-size:12px;line-height:1.6">
      Every name below is a <strong style="color:#fff">real, licensed boiler technician</strong> in Michigan — sourced from MIOSHA state license records, cross-referenced against job boards and public employment data. Our system scans these sources <strong style="color:#fff">every single day</strong> and alerts you the moment someone new appears — a newly issued license, a status change, or a tech posting their resume.<br/><br/>
      <strong style="color:#00d4ff">Why this matters:</strong> The average boiler tech generates <strong style="color:#10b981">$150K–$250K/year</strong> in revenue. Finding one before your competitor does is worth more than any job board ad.
    </div>
  </div>

  <!-- Predictive signals -->
  <div style="margin-bottom:20px">
    <div style="color:rgba(255,255,255,0.3);font-size:10px;font-weight:700;letter-spacing:1px;margin-bottom:10px">PREDICTIVE MOBILITY SIGNALS</div>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:50%;padding:6px">
          <div style="background:#111d2e;border-radius:8px;padding:12px;border:1px solid rgba(255,255,255,0.05)">
            <div style="font-size:18px;margin-bottom:4px">🆕</div>
            <div style="color:#fff;font-size:11px;font-weight:700">Newly Licensed</div>
            <div style="color:rgba(255,255,255,0.35);font-size:10px">Just passed their exam — actively looking for work</div>
          </div>
        </td>
        <td style="width:50%;padding:6px">
          <div style="background:#111d2e;border-radius:8px;padding:12px;border:1px solid rgba(255,255,255,0.05)">
            <div style="font-size:18px;margin-bottom:4px">🔄</div>
            <div style="color:#fff;font-size:11px;font-weight:700">License Status Change</div>
            <div style="color:rgba(255,255,255,0.35);font-size:10px">Renewal, lapse, or reinstatement — signals career shift</div>
          </div>
        </td>
      </tr>
      <tr>
        <td style="width:50%;padding:6px">
          <div style="background:#111d2e;border-radius:8px;padding:12px;border:1px solid rgba(255,255,255,0.05)">
            <div style="font-size:18px;margin-bottom:4px">📋</div>
            <div style="color:#fff;font-size:11px;font-weight:700">Resume Detected</div>
            <div style="color:rgba(255,255,255,0.35);font-size:10px">Posted on Indeed, ZipRecruiter, or LinkedIn</div>
          </div>
        </td>
        <td style="width:50%;padding:6px">
          <div style="background:#111d2e;border-radius:8px;padding:12px;border:1px solid rgba(255,255,255,0.05)">
            <div style="font-size:18px;margin-bottom:4px">⚡</div>
            <div style="color:#fff;font-size:11px;font-weight:700">High-Demand Alert</div>
            <div style="color:rgba(255,255,255,0.35);font-size:10px">2+ competitors also searching for this role</div>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Revealed candidates -->
  <div style="color:rgba(255,255,255,0.3);font-size:10px;font-weight:700;letter-spacing:1px;margin-bottom:8px">CANDIDATES FOUND: ${totalCount} BOILER TECHNICIANS</div>
  <table width="100%" cellpadding="0" cellspacing="0">
    ${revealedHTML}
  </table>

  ${blurred.length > 0 ? `
  <!-- Blurred candidates -->
  <div style="margin-top:16px;text-align:center">
    <div style="color:#00d4ff;font-size:14px;font-weight:800;margin-bottom:8px">+ ${blurred.length} MORE CANDIDATES LOCKED</div>
    <div style="color:rgba(255,255,255,0.3);font-size:11px;margin-bottom:12px">Subscribe to TechAlert to unlock full profiles, contact info, and daily alerts</div>
  </div>
  <table width="100%" cellpadding="0" cellspacing="0">
    ${blurredHTML}
  </table>
  ${blurred.length > 30 ? `<div style="text-align:center;padding:10px 0;color:rgba(255,255,255,0.2);font-size:11px">... and ${blurred.length - 30} more</div>` : ""}
  ` : ""}
</td></tr>

<!-- SECTION 4: COMPARISON -->
<tr><td style="padding:30px 24px;background:#0d1f38;border-left:1px solid rgba(0,212,255,0.15);border-right:1px solid rgba(0,212,255,0.15)">
  <div style="font-size:10px;letter-spacing:2px;color:#00d4ff;font-weight:700;margin-bottom:6px">04 — WHY SWITCH</div>
  <div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:16px">FieldDesk vs. eWay-CRM</div>

  <div style="background:#0a1628;border:1px solid rgba(0,212,255,0.1);border-radius:10px;overflow:hidden">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr style="background:rgba(0,212,255,0.05)">
        <td style="padding:10px 14px;color:rgba(255,255,255,0.3);font-size:10px;font-weight:700">FEATURE</td>
        <td style="padding:10px 14px;color:#00d4ff;font-size:10px;font-weight:700;text-align:center">FIELDDESK</td>
        <td style="padding:10px 14px;color:rgba(255,255,255,0.3);font-size:10px;font-weight:700;text-align:center">eWay-CRM</td>
      </tr>
      ${featureRows}
    </table>
  </div>
</td></tr>

<!-- SECTION 5: PRICING -->
<tr><td style="padding:30px 24px;background:#0a1628;border-left:1px solid rgba(0,212,255,0.15);border-right:1px solid rgba(0,212,255,0.15)">
  <div style="font-size:10px;letter-spacing:2px;color:#00d4ff;font-weight:700;margin-bottom:6px">05 — PRICING</div>
  <div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:20px">Simple. No Per-User Fees.</div>

  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="width:33%;padding:6px;vertical-align:top">
        <div style="background:#111d2e;border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:18px;text-align:center">
          <div style="color:#00d4ff;font-size:11px;font-weight:700;margin-bottom:8px">FIELDDESK</div>
          <div style="color:#fff;font-size:28px;font-weight:800">$199</div>
          <div style="color:rgba(255,255,255,0.3);font-size:11px">/month</div>
          <div style="color:rgba(255,255,255,0.4);font-size:10px;margin-top:8px">Unlimited techs<br/>Unlimited jobs</div>
        </div>
      </td>
      <td style="width:33%;padding:6px;vertical-align:top">
        <div style="background:#111d2e;border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:18px;text-align:center">
          <div style="color:#00d4ff;font-size:11px;font-weight:700;margin-bottom:8px">TECHALERT</div>
          <div style="color:#fff;font-size:28px;font-weight:800">$149</div>
          <div style="color:rgba(255,255,255,0.3);font-size:11px">/month</div>
          <div style="color:rgba(255,255,255,0.4);font-size:10px;margin-top:8px">Daily scans<br/>Instant alerts</div>
        </div>
      </td>
      <td style="width:33%;padding:6px;vertical-align:top">
        <div style="background:linear-gradient(135deg,rgba(0,212,255,0.1),rgba(0,102,255,0.08));border:2px solid rgba(0,212,255,0.3);border-radius:10px;padding:18px;text-align:center">
          <div style="color:#00d4ff;font-size:11px;font-weight:700;margin-bottom:8px">⭐ BUNDLE</div>
          <div style="color:#fff;font-size:28px;font-weight:800">$278</div>
          <div style="color:rgba(255,255,255,0.3);font-size:11px">/month</div>
          <div style="color:#10b981;font-size:10px;font-weight:700;margin-top:8px">SAVE $70/mo</div>
        </div>
      </td>
    </tr>
  </table>
</td></tr>

<!-- CTA -->
<tr><td style="padding:30px 24px 40px;background:#0a1628;border:1px solid rgba(0,212,255,0.15);border-top:none;border-radius:0 0 16px 16px;text-align:center">
  <div style="font-size:18px;font-weight:800;color:#fff;margin-bottom:8px">Ready to see it live?</div>
  <div style="color:rgba(255,255,255,0.4);font-size:13px;margin-bottom:24px">15 minutes. I'll show you the dispatch board with your real data.</div>
  <a href="mailto:matt@detroitwebagent.com?subject=Demo%20Request%20-%20${encodeURIComponent(company)}" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#00d4ff,#0066ff);color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;border-radius:10px">Schedule a 15-Minute Demo →</a>
  <div style="margin-top:16px;color:rgba(255,255,255,0.25);font-size:11px">Or just reply to this email — Matt Michels, (313) 992-1219</div>
</td></tr>

<!-- Footer -->
<tr><td style="padding:20px;text-align:center">
  <div style="color:rgba(255,255,255,0.15);font-size:10px">Detroit Web Agency · Grosse Pointe, MI · detroitwebagent.com</div>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    // Send via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "Matt Michels <matt@detroitwebagent.com>",
        to: [email],
        subject: `${company} — Your Field Operations Platform is Ready`,
        html,
      }),
    });

    const result = await res.json();

    return new Response(JSON.stringify({ 
      ok: true, 
      total: totalCount, 
      revealed: revealed.length, 
      blurred: blurred.length,
      result 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
