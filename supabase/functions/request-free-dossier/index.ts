// Public free-dossier request flow.
// Validates a work email, picks a high-confidence Growth Signal, generates a 1-page
// HTML preview using the existing dossier renderer logic, and logs the request.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

// Block obvious throwaway/personal email domains so the lead is real B2B.
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
  "icloud.com", "me.com", "mail.com", "proton.me", "protonmail.com",
  "yandex.com", "gmx.com", "live.com", "msn.com", "comcast.net",
  "att.net", "verizon.net", "sbcglobal.net", "ymail.com", "rocketmail.com",
]);
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "trashmail.com", "throwawaymail.com", "yopmail.com", "fakeinbox.com",
  "sharklasers.com", "getnada.com", "temp-mail.org",
]);

function validateEmail(raw: string): { ok: boolean; reason?: string; domain?: string } {
  const email = String(raw || "").trim().toLowerCase();
  if (!email) return { ok: false, reason: "Email is required" };
  if (email.length > 255) return { ok: false, reason: "Email is too long" };
  const m = email.match(/^[a-z0-9._%+\-]+@([a-z0-9.\-]+\.[a-z]{2,})$/i);
  if (!m) return { ok: false, reason: "Please enter a valid email address" };
  const domain = m[1].toLowerCase();
  if (DISPOSABLE_DOMAINS.has(domain)) return { ok: false, reason: "Please use a real work email" };
  if (FREE_EMAIL_DOMAINS.has(domain)) return { ok: false, reason: "Please use your work email — free email providers can't be verified" };
  return { ok: true, domain };
}

interface Signal {
  id: string;
  company_name: string;
  location: string | null;
  industry: string | null;
  hiring_roles: string[];
  hiring_count: number;
  predicted_needs: string[];
  confidence: number;
  recommended_pitch: string | null;
  source_urls: string[];
  detected_at: string;
}

async function aiBlurb(s: Signal): Promise<string> {
  const fallback = `${s.company_name} is hiring ${s.hiring_count}+ ${(s.hiring_roles || []).join(", ")} in ${s.location || "Metro Detroit"} — a strong indicator of imminent supplier spend on ${(s.predicted_needs || []).slice(0, 3).join(", ")}.`;
  if (!LOVABLE_API_KEY) return fallback;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 250,
        messages: [
          { role: "system", content: "You write tight, professional B2B intelligence briefs for industrial supply houses. 3 sentences max. No fluff. No bullet points. No emojis." },
          { role: "user", content: `Company: ${s.company_name}\nLocation: ${s.location}\nIndustry: ${s.industry}\nHiring: ${s.hiring_count}x ${(s.hiring_roles || []).join(", ")}\nPredicted needs: ${(s.predicted_needs || []).join(", ")}\n\nWrite a 3-sentence intelligence brief explaining why this hiring signal indicates imminent supplier spend. Tone: factual, confident.` },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const d = await res.json();
    return d?.choices?.[0]?.message?.content?.trim() || fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(s: string): string {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function renderPreviewHtml(s: Signal, blurb: string): string {
  const date = new Date(s.detected_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const conf = s.confidence >= 8 ? "HIGH" : s.confidence >= 5 ? "MEDIUM" : "LOW";
  const company = escapeHtml(s.company_name);
  const blurbHtml = escapeHtml(blurb);
  const pitch = s.recommended_pitch ? escapeHtml(s.recommended_pitch) : "";
  const needs = (s.predicted_needs || []).map(n => `<span class="need">${escapeHtml(n)}</span>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${company} — Industrial Growth Signal</title>
<style>
  body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #0a1628; margin: 0; padding: 24px; line-height: 1.5; background: #f8fafc; }
  .wrap { max-width: 720px; margin: 0 auto; background: #fff; padding: 32px; border-radius: 8px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .hdr { border-bottom: 3px solid #00a8cc; padding-bottom: 12px; margin-bottom: 20px; }
  .brand { font-size: 11px; letter-spacing: 2px; color: #00a8cc; font-weight: 700; }
  h1 { font-size: 22px; margin: 4px 0; color: #0a1628; }
  .sub { font-size: 13px; color: #4b5563; margin: 0; }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 1px; margin-left: 8px; vertical-align: middle; background: #d1fae5; color: #065f46; }
  .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 16px 0 22px; padding: 14px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; }
  .meta strong { display: block; font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 3px; }
  .meta span { font-size: 13px; color: #0a1628; font-weight: 600; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 1.2px; color: #00a8cc; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
  .blurb { font-size: 13px; line-height: 1.65; color: #1f2937; margin-bottom: 14px; }
  .needs { display: flex; flex-wrap: wrap; gap: 6px; }
  .need { background: #ecfeff; color: #0e7490; padding: 5px 10px; border-radius: 12px; font-size: 11px; border: 1px solid #cffafe; }
  .roles { background: #fffbeb; padding: 12px 14px; border-left: 3px solid #f59e0b; font-size: 12px; color: #78350f; margin: 8px 0; }
</style></head><body><div class="wrap">
  <div class="hdr">
    <div class="brand">DETROIT WEB AGENCY · INDUSTRIAL GROWTH SIGNAL</div>
    <h1>${company}<span class="badge">${conf} CONFIDENCE · ${s.confidence}/10</span></h1>
    <p class="sub">${escapeHtml(s.location || "Metro Detroit")} · ${escapeHtml(s.industry || "Industrial")} · Detected ${date}</p>
  </div>
  <div class="meta">
    <div><strong>Hiring Volume</strong><span>${s.hiring_count}+ openings</span></div>
    <div><strong>Industry</strong><span>${escapeHtml(s.industry || "—")}</span></div>
    <div><strong>Location</strong><span>${escapeHtml(s.location || "Michigan")}</span></div>
    <div><strong>Confidence</strong><span>${s.confidence}/10</span></div>
  </div>
  <h2>Intelligence Summary</h2>
  <p class="blurb">${blurbHtml}</p>
  <h2>Roles Being Hired</h2>
  <div class="roles"><strong>${s.hiring_count}× ${escapeHtml((s.hiring_roles || []).join(" · "))}</strong></div>
  <h2>Predicted Supplier Spend</h2>
  <div class="needs">${needs}</div>
  ${pitch ? `<h2>Recommended Approach</h2><p class="blurb" style="font-style:italic;">${pitch}</p>` : ""}
</div></body></html>`;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { email: rawEmail, company: rawCompany, source: rawSource } = body || {};

    const v = validateEmail(rawEmail);
    if (!v.ok) {
      return new Response(JSON.stringify({ error: v.reason }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const email = String(rawEmail).trim().toLowerCase();
    const company = String(rawCompany || "").trim().slice(0, 200) || null;
    const source = String(rawSource || "").trim().slice(0, 100) || null;

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // Rate-limit: max 3 free dossier previews per email per 24h.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await sb
      .from("free_dossier_requests")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", since);
    if ((recentCount || 0) >= 3) {
      return new Response(JSON.stringify({ error: "You've already pulled 3 previews today. Check your inbox or upgrade for the full feed." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pick a strong, recent signal the prospect hasn't seen yet (deterministic per email so they get the same one on refresh).
    const { data: signals } = await sb
      .from("industry_pulse_signals")
      .select("id,company_name,location,industry,hiring_roles,hiring_count,predicted_needs,confidence,recommended_pitch,source_urls,detected_at")
      .gte("confidence", 7)
      .order("detected_at", { ascending: false })
      .limit(40);

    if (!signals || signals.length === 0) {
      return new Response(JSON.stringify({ error: "No signals available right now — check back tomorrow." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deterministic pick: hash(email) → index, so a given email always gets the same signal until they request another.
    const hash = await sha256Hex(email);
    const idx = parseInt(hash.slice(0, 8), 16) % signals.length;
    const signal = signals[idx] as Signal;

    const blurb = await aiBlurb(signal);
    const html = renderPreviewHtml(signal, blurb);

    // Log the request (non-blocking failures shouldn't break UX, but we want this row).
    const ipHash = await sha256Hex((req.headers.get("x-forwarded-for") || "anon") + email);
    await sb.from("free_dossier_requests").insert({
      email,
      company,
      signal_id: signal.id,
      signal_company: signal.company_name,
      status: "preview_sent",
      source,
      ip_hash: ipHash.slice(0, 32),
      user_agent: (req.headers.get("user-agent") || "").slice(0, 300),
    });

    return new Response(JSON.stringify({
      html,
      signal_id: signal.id,
      company_name: signal.company_name,
      confidence: signal.confidence,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[request-free-dossier] error", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
