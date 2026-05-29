// whop-store-setup — one-time store branding setup
//
// Run ONCE after initial Whop account creation.
// Generates and uploads: banner, logo, bio for Whop + Gumroad.
// Re-running is safe — it just regenerates and re-uploads branding assets.
//
// POST /whop-store-setup
// Response: { success: true, whop: {...}, gumroad: {...} }

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const WHOP_KEY      = Deno.env.get("WHOP_API_KEY") || "";
const WHOP_COMPANY  = Deno.env.get("WHOP_COMPANY_ID") || "";
const OPENAI_KEY    = Deno.env.get("OPENAI_API_KEY") || "";
const LOVABLE_KEY   = Deno.env.get("LOVABLE_API_KEY") || "";
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const GUMROAD_TOKEN = Deno.env.get("GUMROAD_ACCESS_TOKEN") || "";
const RESEND_KEY    = Deno.env.get("RESEND_API_KEY") || "";
const OWNER_EMAIL   = "matthewmichels4@gmail.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const log = (s: string, d?: unknown) => console.log(`[STORE-SETUP] ${s}${d ? " -- " + JSON.stringify(d) : ""}`);

async function ai(prompt: string): Promise<string> {
  for (const cfg of [
    { url: "https://ai.gateway.lovable.dev/v1/chat/completions", key: LOVABLE_KEY,
      body: { model: "google/gemini-2.5-flash", max_tokens: 600, messages: [{ role: "user", content: prompt }] },
      headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" } },
    { url: "https://api.anthropic.com/v1/messages", key: ANTHROPIC_KEY,
      body: { model: "claude-haiku-4-5-20251001", max_tokens: 600, messages: [{ role: "user", content: prompt }] },
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" } },
    { url: "https://api.openai.com/v1/chat/completions", key: OPENAI_KEY,
      body: { model: "gpt-4o-mini", max_completion_tokens: 600, messages: [{ role: "user", content: prompt }] },
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" } },
  ]) {
    if (!cfg.key) continue;
    try {
      const r = await fetch(cfg.url, { method: "POST", headers: cfg.headers as HeadersInit, body: JSON.stringify(cfg.body), signal: AbortSignal.timeout(30_000) });
      if (r.ok) {
        const d = await r.json();
        const t = d?.choices?.[0]?.message?.content?.trim() || d?.content?.[0]?.text?.trim();
        if (t) return t;
      }
    } catch {}
  }
  return "";
}

async function generateImage(prompt: string, size: "1024x1024" | "1536x1024"): Promise<Uint8Array | null> {
  if (!OPENAI_KEY) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-1", prompt, size, quality: "medium", n: 1 }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) { log("Image gen failed", res.status); return null; }
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return null;
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  } catch (e) {
    log("Image gen error", String(e).slice(0, 80));
    return null;
  }
}

async function uploadToStorage(bytes: Uint8Array, bucket: string, filename: string, contentType: string): Promise<string | null> {
  try { await sb.storage.createBucket(bucket, { public: true }); } catch { }
  const { error } = await sb.storage.from(bucket)
    .upload(filename, new Blob([bytes], { type: contentType }), { contentType, upsert: true });
  if (error) { log(`Storage upload failed (${bucket})`, error.message); return null; }
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${filename}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  log("Starting store setup");

  const results: Record<string, unknown> = {};

  // ── Generate store bio ─────────────────────────────────────────────────────
  const bioRaw = await ai(`Write a compelling seller bio for a Whop/Gumroad digital product store called "DWA AI Tools".

We sell: premium AI prompt libraries, word-for-word scripts, professional templates, 90-day playbooks, and SOP bundles.
Our buyers are: entrepreneurs, SMMA owners, freelancers, content creators, side hustlers, and AI early adopters.
Our edge: 50+ products across 5 distinct formats — not generic prompt dumps. Structured, immediately usable resources.

Write ONLY 3 short punchy sentences (max 120 words total). No headers, no markdown, no commentary, no word count:
1. Who we are and what we build
2. What makes our products different (specific formats, depth, usability)
3. The promise — what buyers walk away with

Tone: confident, direct, no corporate speak. Output ONLY the 3 sentences, nothing else.`);
  // Strip any markdown headers, horizontal rules, or AI meta-commentary
  const bio = bioRaw
    .replace(/^#+\s+.*$/gm, "")
    .replace(/^-{3,}$/gm, "")
    .replace(/\*\*Word count:.*$/gm, "")
    .replace(/\*\*Confidence.*$/gm, "")
    .replace(/^\*.*\*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  results.bio = bio || "DWA AI Tools publishes premium AI resource packs across 5 professional formats: prompt libraries, script packs, templates, playbooks, and SOPs. Every product is built for immediate use — not vague inspiration. Trusted by entrepreneurs, agency owners, and creators who want results, not reading lists.";
  log("Bio generated");

  // ── Generate banner image (landscape 1536x1024) ────────────────────────────
  const bannerPrompt = `Professional store banner for "DWA AI Tools" digital products marketplace. Dark deep background (#0d0d14), electric purple accent colors (#5b1ae8), abstract AI visualization spanning full width (flowing data streams, neural network nodes, circuit patterns, glowing particles). Left side: clean space for text overlay. Right side: dense AI imagery. Wide cinematic landscape format. Premium, modern, tech-forward aesthetic. No faces. No text rendered — leave space for overlay text.`;

  const bannerBytes = await generateImage(bannerPrompt, "1536x1024");
  if (bannerBytes) {
    const bannerUrl = await uploadToStorage(bannerBytes, "dwa-store-branding", "banner.png", "image/png");
    results.banner_url = bannerUrl;
    log("Banner uploaded", { url: bannerUrl?.slice(-40) });
  }

  // ── Generate logo image (square 1024x1024) ────────────────────────────────
  const logoPrompt = `Minimalist brand logo for "DWA AI Tools". Dark square background (#0d0d14). Center: bold "DWA" monogram in electric purple (#5b1ae8) with subtle AI circuit pattern integrated into the letterforms. Clean white glow outline. Ultra simple — reads clearly at 64x64px. No text other than "DWA". No faces. Premium tech brand aesthetic.`;

  const logoBytes = await generateImage(logoPrompt, "1024x1024");
  if (logoBytes) {
    const logoUrl = await uploadToStorage(logoBytes, "dwa-store-branding", "logo.png", "image/png");
    results.logo_url = logoUrl;
    log("Logo uploaded", { url: logoUrl?.slice(-40) });
  }

  // ── Apply branding to Whop ─────────────────────────────────────────────────
  const whopResult: Record<string, unknown> = {};
  if (WHOP_KEY && WHOP_COMPANY) {
    // Try bio + logo only first (banner field varies by API version)
    const patchBody: Record<string, string> = { description: results.bio as string };
    if (results.logo_url) patchBody.image = results.logo_url as string;

    const patchRes = await fetch(`https://api.whop.com/api/v1/companies/${WHOP_COMPANY}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${WHOP_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(patchBody),
      signal: AbortSignal.timeout(15_000),
    }).catch(e => ({ ok: false, status: 0, text: async () => String(e) } as any));

    const patchText = await (patchRes as Response).text().catch(() => "");
    if ((patchRes as Response).ok) {
      whopResult.bio_and_logo = "updated";
      log("Whop bio + logo updated");
    } else {
      whopResult.patch_error = `${(patchRes as Response).status}: ${patchText.slice(0, 200)}`;
      log("Whop PATCH error", whopResult.patch_error);
    }

    // Banner: Whop v1 API does not support banner via API — must be set in dashboard
    // Store the banner URL so Matt can upload it manually if needed
    whopResult.banner_note = results.banner_url
      ? `Banner image ready at ${results.banner_url} — upload manually at whop.com/dashboard → Store Settings → Banner`
      : "Banner generation failed";
    log("Banner note", whopResult.banner_note);
  } else {
    whopResult.skipped = "WHOP_API_KEY or WHOP_COMPANY_ID not set";
  }
  results.whop = whopResult;

  // ── Apply branding to Gumroad ─────────────────────────────────────────────
  const gumroadResult: Record<string, unknown> = {};
  if (GUMROAD_TOKEN) {
    // Update bio
    const bioRes = await fetch("https://api.gumroad.com/v2/user", {
      method: "PUT",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ access_token: GUMROAD_TOKEN, bio: (results.bio as string).slice(0, 500) }).toString(),
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    gumroadResult.bio_updated = (bioRes as Response)?.ok ?? false;

    // Upload avatar/logo
    if (logoBytes) {
      const avatarForm = new FormData();
      avatarForm.append("access_token", GUMROAD_TOKEN);
      avatarForm.append("file", new Blob([logoBytes], { type: "image/png" }), "logo.png");
      const avatarRes = await fetch("https://api.gumroad.com/v2/user/avatar", {
        method: "PUT", body: avatarForm, signal: AbortSignal.timeout(30_000),
      }).catch(() => null);
      gumroadResult.avatar_updated = (avatarRes as Response)?.ok ?? false;
      log("Gumroad avatar upload attempted", { ok: gumroadResult.avatar_updated });
    }
  } else {
    gumroadResult.skipped = "GUMROAD_ACCESS_TOKEN not set";
  }
  results.gumroad = gumroadResult;

  // ── Email confirmation to Matt ─────────────────────────────────────────────
  if (RESEND_KEY) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Store Setup <matt@detroitwebagent.com>",
        to: [OWNER_EMAIL],
        subject: "✅ DWA AI Tools store branding applied",
        html: `<div style="font-family:sans-serif;max-width:580px;padding:20px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
<h2 style="color:#8b5cf6;">✅ DWA AI Tools Store Setup Complete</h2>
<p><strong>Bio:</strong> ${results.bio}</p>
${results.banner_url ? `<p><strong>Banner:</strong> <a href="${results.banner_url}" style="color:#8b5cf6;">View →</a></p>` : "<p style='color:#f59e0b;'>⚠ Banner generation failed — retry setup</p>"}
${results.logo_url ? `<p><strong>Logo:</strong> <a href="${results.logo_url}" style="color:#8b5cf6;">View →</a></p>` : "<p style='color:#f59e0b;'>⚠ Logo generation failed — retry setup</p>"}
<p><strong>Whop:</strong> ${JSON.stringify(whopResult)}</p>
<p><strong>Gumroad:</strong> ${JSON.stringify(gumroadResult)}</p>
<p style="color:#334155;font-size:11px;margin-top:16px;">Run whop-product-publisher?batch=10 next to publish 10 products with covers.</p>
</div>`,
      }),
    }).catch(() => {});
  }

  log("Store setup complete", results);
  return new Response(JSON.stringify({ success: true, ...results }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
