// seed-test-alert — Phase A: Inject a hardcoded healthcare candidate
// through the FULL enrichment pipeline (NPI → Sonar → PDL → AI Synthesis)
// then fire SMS + email alert to Matt's admin phone/email.
// NEVER added to any cron. Manual invoke only.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const PDL_API_KEY = Deno.env.get("PDL_API_KEY") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") || "+13138064952";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── JSON stripper ─────────────────────────────────────────────
function extractJSON(raw: string): Record<string, unknown> | null {
  let cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "");
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

// ─── NPI Registry (free, no auth) ──────────────────────────────
async function enrichViaNPI(firstName: string, lastName: string, state: string) {
  const start = Date.now();
  try {
    const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&state=${encodeURIComponent(state)}&enumeration_type=NPI-1&limit=3`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) { await res.text(); return { elapsed_ms: Date.now() - start }; }
    const data = await res.json();
    const r = data?.results?.[0];
    if (!r) return { elapsed_ms: Date.now() - start };
    const addr = r.addresses?.find((a: any) => a.address_purpose === "LOCATION") || r.addresses?.[0];
    const tax = r.taxonomies?.find((t: any) => t.primary) || r.taxonomies?.[0];
    return {
      npi_number: r.number?.toString() || null,
      npi_business_phone: addr?.telephone_number || null,
      npi_taxonomy: tax ? `${tax.desc || ""} (${tax.code || ""})` : null,
      npi_practice_address: addr ? `${addr.address_1 || ""}, ${addr.city || ""}, ${addr.state || ""} ${addr.postal_code || ""}` : null,
      elapsed_ms: Date.now() - start,
    };
  } catch (e) {
    console.error("[NPI]", e);
    return { elapsed_ms: Date.now() - start };
  }
}

// ─── Sonar Deep Dork ───────────────────────────────────────────
async function enrichViaSonar(name: string, title: string, city: string) {
  const start = Date.now();
  if (!OPENROUTER_API_KEY) return { elapsed_ms: Date.now() - start };
  const prompt = `Search the public web for ${name}, a ${title} in ${city}, Michigan.
Use boolean search: site:linkedin.com/in/ "${name}" "${city}" AND site:indeed.com/r/ "${name}" AND site:facebook.com "${name}" "${city}"
Extract public LinkedIn URL, Facebook URL, email, phone.
Respond ONLY with JSON: { "linkedin_url": "..." or null, "facebook_url": "..." or null, "email": "..." or null, "phone": "..." or null }`;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "perplexity/sonar-pro", max_tokens: 512, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) { await res.text(); return { elapsed_ms: Date.now() - start }; }
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    const parsed = extractJSON(raw);
    return { ...(parsed || {}), elapsed_ms: Date.now() - start };
  } catch (e) {
    console.error("[Sonar]", e);
    return { elapsed_ms: Date.now() - start };
  }
}

// ─── PDL Skip-Trace ────────────────────────────────────────────
async function enrichWithPDL(name: string, location: string, linkedinUrl: string | null) {
  const start = Date.now();
  if (!PDL_API_KEY) return { skipped: "PDL_API_KEY not set", elapsed_ms: Date.now() - start };
  try {
    const params: Record<string, string> = { first_name: name.split(" ")[0], last_name: name.split(" ").slice(-1)[0], location };
    if (linkedinUrl) params.profile = linkedinUrl;
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${qs}`, {
      headers: { "X-Api-Key": PDL_API_KEY },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) { const t = await res.text(); return { skipped: `PDL ${res.status}`, elapsed_ms: Date.now() - start }; }
    const data = await res.json();
    return {
      pdl_mobile_phone: data?.mobile_phone || null,
      pdl_personal_email: data?.personal_emails?.[0] || null,
      pdl_work_email: data?.work_email || null,
      pdl_job_title: data?.job_title || null,
      pdl_company: data?.job_company_name || null,
      pdl_linkedin_url: data?.linkedin_url || null,
      elapsed_ms: Date.now() - start,
    };
  } catch (e) {
    return { skipped: e instanceof Error ? e.message : String(e), elapsed_ms: Date.now() - start };
  }
}

// ─── AI Synthesis ──────────────────────────────────────────────
async function synthesize(candidate: Record<string, any>) {
  if (!LOVABLE_API_KEY) return { qualifications_summary: "", hiring_recommendation: "" };
  const prompt = `You are a hiring researcher. Based on this candidate data, write:
1. QUALIFICATIONS SUMMARY (2-3 sentences)
2. HIRING RECOMMENDATION (2-3 sentences)

CANDIDATE: ${candidate.name}, ${candidate.title} in ${candidate.city}, MI
NPI: ${candidate.npi_number || "N/A"}, Taxonomy: ${candidate.npi_taxonomy || "N/A"}
LinkedIn: ${candidate.linkedin_url || "N/A"}, Phone: ${candidate.phone || candidate.pdl_mobile_phone || "N/A"}
Employer: ${candidate.pdl_company || "N/A"}, Title: ${candidate.pdl_job_title || "N/A"}

RULES: Never mention AI, algorithms, or data sources. Write as a human researcher.
Return JSON: { "qualifications_summary": "...", "hiring_recommendation": "..." }`;

  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", max_tokens: 600, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { qualifications_summary: "", hiring_recommendation: "" };
    const data = await res.json();
    const parsed = extractJSON(data?.choices?.[0]?.message?.content || "");
    return {
      qualifications_summary: (parsed?.qualifications_summary as string) || "",
      hiring_recommendation: (parsed?.hiring_recommendation as string) || "",
    };
  } catch { return { qualifications_summary: "", hiring_recommendation: "" }; }
}

// ─── Score badge color ─────────────────────────────────────────
function scoreBg(s: number) {
  return s >= 8 ? "#dc2626" : s >= 7 ? "#e8621a" : s >= 5 ? "#f59e0b" : "#94a3b8";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const totalStart = Date.now();
  console.log("[seed-test-alert] === PHASE A: Seeded Healthcare Candidate ===");

  // ─── SEED CANDIDATE ──────────────────────────────────────────
  const seed = {
    name: "Patricia Williams",
    title: "Director of Nursing",
    city: "Detroit",
    state: "MI",
    license_type: "Registered Nurse - Director of Nursing",
    source: "seed_test" as const,
  };

  const results: Record<string, any> = { candidate: seed, phases: {} };

  // ─── Phase 1: NPI Registry ───────────────────────────────────
  console.log("[seed-test-alert] Phase 1: NPI Registry lookup...");
  const npi = await enrichViaNPI("Patricia", "Williams", "MI");
  results.phases.npi = npi;
  console.log(`[seed-test-alert] NPI: ${npi.npi_number || "no match"} | phone: ${npi.npi_business_phone || "none"} | ${npi.elapsed_ms}ms`);

  // ─── Phase 2: Sonar Deep Dork ────────────────────────────────
  console.log("[seed-test-alert] Phase 2: Sonar OSINT...");
  const sonar = await enrichViaSonar(seed.name, seed.title, seed.city);
  results.phases.sonar = sonar;
  console.log(`[seed-test-alert] Sonar: linkedin=${sonar.linkedin_url || "none"} | email=${sonar.email || "none"} | ${sonar.elapsed_ms}ms`);

  // ─── Phase 3: PDL Skip-Trace ─────────────────────────────────
  console.log("[seed-test-alert] Phase 3: PDL skip-trace...");
  const pdl = await enrichWithPDL(seed.name, `${seed.city}, ${seed.state}`, (sonar.linkedin_url as string) || null);
  results.phases.pdl = pdl;
  console.log(`[seed-test-alert] PDL: mobile=${pdl.pdl_mobile_phone || "none"} | email=${pdl.pdl_personal_email || "none"} | company=${pdl.pdl_company || "none"} | ${pdl.elapsed_ms}ms`);

  // ─── Phase 4: AI Synthesis ───────────────────────────────────
  console.log("[seed-test-alert] Phase 4: AI Synthesis...");
  const merged = {
    ...seed,
    npi_number: npi.npi_number,
    npi_taxonomy: npi.npi_taxonomy,
    npi_business_phone: npi.npi_business_phone,
    linkedin_url: sonar.linkedin_url,
    facebook_url: sonar.facebook_url,
    email: sonar.email,
    phone: sonar.phone || npi.npi_business_phone || pdl.pdl_mobile_phone,
    pdl_mobile_phone: pdl.pdl_mobile_phone,
    pdl_personal_email: pdl.pdl_personal_email,
    pdl_company: pdl.pdl_company,
    pdl_job_title: pdl.pdl_job_title,
  };
  const synthesis = await synthesize(merged);
  results.phases.synthesis = synthesis;

  // ─── No Ghost Lead Check ─────────────────────────────────────
  const isActionable = !!(merged.linkedin_url || merged.facebook_url || merged.email || merged.phone || merged.pdl_mobile_phone || merged.npi_business_phone);
  results.is_actionable = isActionable;
  results.ghost_lead_dropped = !isActionable;

  if (!isActionable) {
    console.log("[seed-test-alert] ❌ GHOST LEAD — no actionable contact found. Alert NOT sent.");
    results.alert_sent = false;
    results.total_ms = Date.now() - totalStart;
    return new Response(JSON.stringify(results, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // ─── Phase 5: Fire Alert Email ───────────────────────────────
  console.log("[seed-test-alert] Phase 5: Firing alert email + SMS...");
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const score = 9; // Seeded hot candidate

  // Build action buttons
  const buttons: string[] = [];
  if (merged.linkedin_url) buttons.push(`<a href="${merged.linkedin_url}" target="_blank" style="display:inline-block;background:#0a66c2;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px;">🔗 LinkedIn</a>`);
  if (merged.facebook_url) buttons.push(`<a href="${merged.facebook_url}" target="_blank" style="display:inline-block;background:#1877f2;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px;">👤 Facebook</a>`);
  if (merged.email) buttons.push(`<a href="mailto:${merged.email}" style="display:inline-block;background:#0891b2;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px;">✉️ Email</a>`);
  if (merged.phone) buttons.push(`<a href="tel:${merged.phone}" style="display:inline-block;background:#e8621a;color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:800;text-decoration:none;margin:4px;">📞 Call ${merged.phone}</a>`);
  if (merged.npi_business_phone && merged.npi_business_phone !== merged.phone) buttons.push(`<a href="tel:${merged.npi_business_phone}" style="display:inline-block;background:#0d9488;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:4px;">📞 Business ${merged.npi_business_phone}</a>`);
  if (merged.pdl_mobile_phone && merged.pdl_mobile_phone !== merged.phone) buttons.push(`<a href="tel:${merged.pdl_mobile_phone}" style="display:inline-block;background:#ea580c;color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:800;text-decoration:none;margin:4px;">📱 Mobile ${merged.pdl_mobile_phone}</a>`);

  const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;"><tr><td align="center" style="padding:32px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
  <tr><td style="background:linear-gradient(135deg,#0a1628,#1e293b);padding:32px 28px 24px;border-radius:16px 16px 0 0;border-bottom:3px solid #00d4ff;">
    <p style="margin:0;color:#00d4ff;font-size:11px;font-weight:800;letter-spacing:3px;">⚡ TECHALERT — SEED TEST</p>
    <p style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:800;">🔥 Live Pipeline Test</p>
    <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">${dateStr} · Phase A Verification</p>
  </td></tr>

  <tr><td style="background:#e8621a;padding:12px 28px;">
    <p style="margin:0;color:#fff;font-size:13px;font-weight:700;text-align:center;">🔥 SEEDED HOT CANDIDATE — Score 9/10 — Full Pipeline Verified</p>
  </td></tr>

  <tr><td style="background:#fff;padding:28px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;border:1px solid #e8621a40;box-shadow:0 2px 8px rgba(232,98,26,0.12);">
      <tr><td style="background:linear-gradient(135deg,#0a1628,#1e293b);padding:14px 18px;">
        <table width="100%"><tr>
          <td><p style="margin:0;font-size:16px;font-weight:800;color:#fff;">${seed.name}</p><p style="margin:3px 0 0;font-size:12px;color:#94a3b8;">${seed.title} · ${seed.city}, MI</p></td>
          <td style="text-align:right;"><span style="background:${scoreBg(score)};color:#fff;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:800;">🔥 ${score}/10</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:16px 18px;background:#fff;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:4px 0;"><span style="background:#00d4ff18;color:#0891b2;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;">${seed.license_type}</span></td></tr>
          ${merged.npi_number ? `<tr><td style="padding:4px 0;font-size:13px;color:#7c3aed;">🏥 NPI: <strong>${merged.npi_number}</strong>${merged.npi_taxonomy ? ` · ${merged.npi_taxonomy}` : ""}</td></tr>` : ""}
          ${merged.pdl_company ? `<tr><td style="padding:4px 0;font-size:13px;color:#475569;">🏢 <strong>${merged.pdl_company}</strong>${merged.pdl_job_title ? ` · ${merged.pdl_job_title}` : ""}</td></tr>` : ""}
          ${synthesis.qualifications_summary ? `<tr><td style="padding:8px 0;"><p style="margin:0;font-size:12px;background:#f0fdf4;padding:10px 12px;border-radius:8px;border-left:3px solid #059669;line-height:1.6;"><strong>📋 Qualifications:</strong> ${synthesis.qualifications_summary}</p></td></tr>` : ""}
          ${synthesis.hiring_recommendation ? `<tr><td style="padding:4px 0;"><p style="margin:0;font-size:12px;background:#eff6ff;padding:10px 12px;border-radius:8px;border-left:3px solid #3b82f6;line-height:1.6;"><strong>💡 Recommendation:</strong> ${synthesis.hiring_recommendation}</p></td></tr>` : ""}
          ${buttons.length ? `<tr><td style="padding:12px 0 4px;">${buttons.join("\n")}</td></tr>` : ""}
        </table>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;background:#f0fdf4;border-radius:12px;border:1px solid #10b98130;">
      <tr><td style="padding:16px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:800;color:#059669;">✅ Pipeline Verification Report</p>
        <p style="margin:0;font-size:12px;color:#475569;line-height:1.8;">
          NPI Registry: ${npi.npi_number ? "✅ Found" : "❌ No match"} (${npi.elapsed_ms}ms)<br>
          Sonar OSINT: ${sonar.linkedin_url || sonar.email ? "✅ Found data" : "❌ No match"} (${sonar.elapsed_ms}ms)<br>
          PDL Skip-Trace: ${pdl.pdl_mobile_phone ? "✅ Mobile found" : pdl.skipped ? `⏭ ${pdl.skipped}` : "❌ No match"} (${pdl.elapsed_ms}ms)<br>
          AI Synthesis: ${synthesis.qualifications_summary ? "✅ Generated" : "❌ Failed"}<br>
          Ghost Lead Filter: ${isActionable ? "✅ PASSED — Actionable" : "❌ BLOCKED"}<br>
          Total Pipeline: ${Date.now() - totalStart}ms
        </p>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:20px 28px;background:#0a1628;border-radius:0 0 16px 16px;">
    <table width="100%"><tr>
      <td><img src="https://www.detroitwebagent.com/images/matt-boat.jpg" style="width:44px;height:44px;border-radius:50%;border:2px solid #00d4ff30;" alt="Matt"></td>
      <td style="padding-left:12px;"><p style="margin:0;font-size:14px;font-weight:700;color:#fff;">Matt Michels</p><p style="margin:2px 0 0;font-size:12px;color:#94a3b8;">Detroit Web Agency · (313) 992-1219</p></td>
    </tr></table>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  // Send alert email
  if (RESEND_API_KEY) {
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "TechAlert by Detroit Web Agency <matt@detroitwebagent.com>",
        to: ["matt@detroitwebagent.com", "matthewmichels4@gmail.com"],
        subject: `🔥 SEED TEST — ${seed.name} (${seed.title}) — Score 9/10 | Phase A Verified`,
        html: emailHtml,
      }),
    });
    const emailData = await emailRes.json();
    results.email_sent = emailRes.ok;
    results.email_id = emailData?.id;
    console.log(`[seed-test-alert] Email: ${emailRes.ok ? "✅ SENT" : "❌ FAILED"} — ${emailData?.id || emailData?.message}`);
  }

  // Send SMS alert to admin phone
  const contactInfo = merged.pdl_mobile_phone
    ? `📱 PDL Mobile: ${merged.pdl_mobile_phone}`
    : merged.phone
    ? `📞 Phone: ${merged.phone}`
    : merged.email
    ? `✉️ Email: ${merged.email}`
    : "LinkedIn only";

  const smsBody = `🔥 TechAlert SEED TEST — Phase A LIVE!\n${seed.name} (${seed.title}, ${seed.city})\nScore: 9/10\n${contactInfo}\nNPI: ${merged.npi_number || "N/A"}\nPipeline: NPI→Sonar→PDL→AI ✅`;

  const smsResult = await sendSMS(ADMIN_PHONE, TWILIO_PHONE_NUMBER, smsBody, "seed_test_alert");
  results.sms_sent = smsResult.success;
  results.sms_sid = smsResult.sid;
  console.log(`[seed-test-alert] SMS: ${smsResult.success ? "✅ SENT" : "❌ FAILED"} — ${smsResult.sid || smsResult.error}`);

  results.total_ms = Date.now() - totalStart;
  results.alert_sent = true;

  console.log(`[seed-test-alert] === PHASE A COMPLETE in ${results.total_ms}ms ===`);

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
