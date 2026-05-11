// Generic AI writer dispatcher — replaces dozens of per-purpose `ai-*-writer` / `ai-*-generator` functions.
// Frontend calls: supabase.functions.invoke("ai-writer-dispatcher", { body: { kind: "blog-post", payload: { ... } } })
//
// To migrate an `ai-foo-writer` function:
// 1. Add its prompt-builder + post-processor to WRITER_KINDS below.
// 2. Update its callsites to invoke "ai-writer-dispatcher" with { kind: "foo", payload }.
// 3. Delete the old function folder + its config.toml block.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type WriterKind = {
  model?: string; // overrides default
  system: string;
  buildPrompt: (payload: any) => string;
  // Optional response shaping
  responseFormat?: "text" | "json";
};

const DEFAULT_MODEL = "google/gemini-2.5-flash"; // cheap default via Lovable Gateway

// Starter catalog. Migrate writers into here over time.
const WRITER_KINDS: Record<string, WriterKind> = {
  "blog-post": {
    system: "You are an expert B2B SEO blog writer. Output clean markdown with H2/H3 sections.",
    buildPrompt: (p) =>
      `Write a 600-900 word blog post titled "${p.title}".\n` +
      `Audience: ${p.audience || "small business owners"}.\n` +
      `Primary keyword: ${p.keyword || p.title}.\n` +
      `Tone: ${p.tone || "professional, plainspoken"}.\n` +
      (p.outline ? `Use this outline:\n${p.outline}\n` : "") +
      `End with a single CTA line.`,
  },
  "press-release": {
    system: "You are a corporate communications writer. Output a standard AP-style press release.",
    buildPrompt: (p) =>
      `Headline: ${p.headline}\nLocation/date: ${p.dateline || "DETROIT, MI"}\n` +
      `Company: ${p.company}\nAnnouncement: ${p.announcement}\n` +
      `Quote (optional): ${p.quote || ""}\nAbout block: ${p.about || ""}`,
  },
  "sales-script": {
    system: "You are a B2B sales coach writing cold-call scripts. Conversational, no jargon.",
    buildPrompt: (p) =>
      `Write a cold-call script for selling ${p.product} to ${p.audience}.\n` +
      `Key pain points: ${(p.painPoints || []).join("; ")}.\n` +
      `Price: ${p.price || "TBD"}. Length: ~90 seconds.\nInclude objection rebuttals for "too expensive" and "not a priority".`,
  },
  "video-script": {
    system: "You are a short-form video scriptwriter (30-60s vertical).",
    buildPrompt: (p) =>
      `Topic: ${p.topic}\nHook (first 3s): make it pattern-interrupt.\nProduct/CTA: ${p.cta}\nTone: ${p.tone || "energetic, direct"}.`,
  },
  "website-copy-refresh": {
    system: "You are a conversion copywriter. Output H1, subheadline, three benefit bullets, CTA.",
    buildPrompt: (p) =>
      `Rewrite the homepage hero for ${p.business} (${p.industry}). Current copy: ${p.current || "n/a"}.\n` +
      `Target customer: ${p.audience}.`,
    responseFormat: "json",
  },
  "social-captions": {
    system: "You are a social media manager. Output 3 caption variants per platform: Instagram, LinkedIn, X.",
    buildPrompt: (p) =>
      `Topic: ${p.topic}\nBrand voice: ${p.voice || "friendly authority"}\nCall to action: ${p.cta || "comment below"}.`,
    responseFormat: "json",
  },
  "direct-mail": {
    system: "You are a direct-response copywriter writing 4x6 postcards.",
    buildPrompt: (p) =>
      `Audience: ${p.audience}\nOffer: ${p.offer}\nDeadline: ${p.deadline || "30 days"}\nHeadline + 40-word body + CTA + phone.`,
  },
  "proposal": {
    system: "You are a B2B services proposal writer. Output sections: Summary, Scope, Deliverables, Timeline, Investment.",
    buildPrompt: (p) =>
      `Client: ${p.client}\nProject: ${p.project}\nPrice: ${p.price}\nTimeline: ${p.timeline || "4 weeks"}\n` +
      `Deliverables: ${(p.deliverables || []).join("; ")}`,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const kind = String(body?.kind || "").trim();
    if (!kind) throw new Error("Missing 'kind' in request body");

    const w = WRITER_KINDS[kind];
    if (!w) throw new Error(`Unknown writer kind: ${kind}`);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = w.buildPrompt(body.payload || {});
    const model = body.model || w.model || DEFAULT_MODEL;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: w.system },
          { role: "user", content: prompt },
        ],
        ...(w.responseFormat === "json" ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI gateway error ${aiRes.status}: ${errText}`);
    }
    const data = await aiRes.json();
    const content = data?.choices?.[0]?.message?.content ?? "";

    return new Response(
      JSON.stringify({
        kind,
        model,
        content,
        ...(w.responseFormat === "json"
          ? { parsed: (() => { try { return JSON.parse(content); } catch { return null; } })() }
          : {}),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[AI-WRITER-DISPATCHER] ERROR", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
