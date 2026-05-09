// Generate-signal-dossier — returns a printable HTML 1-pager for a Growth Signal.
// Admin-only (no JWT verify in config; protected by knowledge of signal_id + admin tab).
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { requireAdmin, escapeHtml, safeHttpsUrl } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

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
  if (!LOVABLE_API_KEY) {
    return `${s.company_name} is actively hiring ${s.hiring_count}+ ${s.hiring_roles.join(", ")} in ${s.location || "Metro Detroit"}. This hiring volume strongly signals upcoming spend on equipment, consumables, and supplier services tied to the ${s.industry || "industrial"} vertical.`;
  }
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 250,
        messages: [
          { role: "system", content: "You write tight, professional B2B intelligence briefs for industrial supply houses. 3 sentences max. No fluff. No bullet points. No emojis." },
          { role: "user", content: `Company: ${s.company_name}\nLocation: ${s.location}\nIndustry: ${s.industry}\nHiring: ${s.hiring_count}x ${s.hiring_roles.join(", ")}\nPredicted needs: ${s.predicted_needs.join(", ")}\n\nWrite a 3-sentence intelligence brief explaining why this hiring signal indicates imminent supplier spend. Tone: factual, confident.` },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const d = await res.json();
    return d?.choices?.[0]?.message?.content?.trim() || "";
  } catch {
    return `${s.company_name} is hiring ${s.hiring_count}+ ${s.hiring_roles.join(", ")} in ${s.location || "Metro Detroit"} — a strong indicator of imminent supplier spend on ${s.predicted_needs.slice(0, 3).join(", ")}.`;
  }
}

function renderHtml(s: Signal, blurb: string): string {
  const date = new Date(s.detected_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const conf = s.confidence >= 8 ? "HIGH" : s.confidence >= 5 ? "MEDIUM" : "LOW";
  const company = escapeHtml(s.company_name);
  const location = escapeHtml(s.location || "Metro Detroit");
  const industry = escapeHtml(s.industry || "Industrial");
  const roles = escapeHtml((s.hiring_roles || []).join(" · "));
  const pitch = escapeHtml(s.recommended_pitch || "");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${company} — Industrial Growth Signal</title>
<style>
  @page { size: letter; margin: 0.6in; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #0a1628; margin: 0; padding: 0; line-height: 1.5; }
  .wrap { max-width: 7in; margin: 0 auto; }
  .hdr { border-bottom: 3px solid #00a8cc; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
  .brand { font-size: 11px; letter-spacing: 2px; color: #00a8cc; font-weight: 700; }
  .doc-id { font-size: 9px; color: #6b7280; font-family: monospace; }
  h1 { font-size: 22px; margin: 4px 0 4px; color: #0a1628; }
  .sub { font-size: 13px; color: #4b5563; margin: 0; }
  .conf-badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 1px; margin-left: 8px; vertical-align: middle; }
  .conf-HIGH { background: #d1fae5; color: #065f46; }
  .conf-MEDIUM { background: #cffafe; color: #155e75; }
  .conf-LOW { background: #f1f5f9; color: #475569; }
  .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0 22px; padding: 14px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; }
  .meta div { font-size: 10px; }
  .meta strong { display: block; font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 3px; font-weight: 600; }
  .meta span { font-size: 13px; color: #0a1628; font-weight: 600; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 1.2px; color: #00a8cc; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
  .blurb { font-size: 13px; line-height: 1.65; color: #1f2937; margin-bottom: 14px; }
  .needs { display: flex; flex-wrap: wrap; gap: 6px; }
  .need { background: #ecfeff; color: #0e7490; padding: 5px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; border: 1px solid #cffafe; }
  .roles { background: #fffbeb; padding: 12px 14px; border-left: 3px solid #f59e0b; font-size: 12px; color: #78350f; margin: 8px 0; }
  .sources { font-size: 9px; color: #6b7280; margin-top: 6px; word-break: break-all; }
  .sources a { color: #00a8cc; text-decoration: none; margin-right: 8px; }
  .ftr { margin-top: 30px; padding-top: 14px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #6b7280; }
  .cta { background: linear-gradient(135deg, #0a1628, #1e293b); color: #fff; padding: 14px 16px; border-radius: 6px; margin-top: 18px; font-size: 11px; }
  .cta strong { color: #00d4ff; display: block; font-size: 13px; margin-bottom: 4px; }
  .cta a { color: #00d4ff; text-decoration: none; }
  @media print { .no-print { display: none; } }
</style></head><body>
<div class="wrap">
  <div class="hdr">
    <div>
      <div class="brand">DETROIT WEB AGENCY · INDUSTRIAL GROWTH SIGNAL</div>
      <h1>${company}<span class="conf-badge conf-${conf}">${conf} CONFIDENCE · ${Number(s.confidence) || 0}/10</span></h1>
      <p class="sub">${location} · ${industry} · Detected ${escapeHtml(date)}</p>
    </div>
    <div class="doc-id">DOC #${escapeHtml(String(s.id).slice(0, 8).toUpperCase())}<br/>${escapeHtml(date)}</div>
  </div>

  <div class="meta">
    <div><strong>Hiring Volume</strong><span>${Number(s.hiring_count) || 0}+ openings</span></div>
    <div><strong>Confidence</strong><span>${Number(s.confidence) || 0}/10</span></div>
    <div><strong>Industry</strong><span>${industry}</span></div>
    <div><strong>Location</strong><span>${location}</span></div>
  </div>

  <h2>Intelligence Summary</h2>
  <p class="blurb">${escapeHtml(blurb)}</p>

  <h2>Roles Being Hired</h2>
  <div class="roles"><strong>${Number(s.hiring_count) || 0}× ${roles}</strong></div>

  <h2>Predicted Supplier Spend</h2>
  <div class="needs">${(s.predicted_needs || []).map(n => `<span class="need">${escapeHtml(n)}</span>`).join("")}</div>

  ${pitch ? `<h2>Recommended Approach</h2><p class="blurb" style="font-style:italic;">${pitch}</p>` : ""}

  ${s.source_urls?.length ? `<div class="sources"><strong>Sources:</strong> ${s.source_urls.slice(0, 4).map((u, i) => `<a href="${safeHttpsUrl(u)}">[${i + 1}]</a>`).join("")}</div>` : ""}

  <div class="cta">
    <strong>Want 5 more like this?</strong>
    Reply YES to this email · $50 for the next 5 dossiers · Or subscribe to weekly Growth Signals at $199/mo for the full firehose. Matt Michels · Detroit Web Agency · matt@detroitwebagent.com · (313) 992-1219
  </div>

  <div class="ftr">
    <span>Detroit Web Agency · detroitwebagent.com</span>
    <span>Compiled from public hiring data · ${escapeHtml(date)}</span>
  </div>
</div>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { signal_id } = await req.json();
    if (!signal_id) {
      return new Response(JSON.stringify({ error: "signal_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data, error } = await sb
      .from("industry_pulse_signals")
      .select("*")
      .eq("id", signal_id)
      .single();
    if (error || !data) {
      return new Response(JSON.stringify({ error: "signal not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const blurb = await aiBlurb(data as Signal);
    const html = renderHtml(data as Signal, blurb);
    return new Response(JSON.stringify({ html, signal_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
