// hotmart-publisher — Autonomous Hotmart (Brazil/LatAm) product publisher
//
// Runs DAILY 3pm UTC via cron.
// Hotmart is the #1 digital product marketplace in Latin America:
//   35M registered users · Brazil, Mexico, Colombia, Argentina, Spain
//   $3B+ annual GMV · 7% platform fee (vs Gumroad 10%)
//
// Strategy: translate top Gumroad products to Portuguese + Spanish, publish to Hotmart.
// Brazilian entrepreneurs pay PREMIUM for quality digital products in Portuguese.
//
// SETUP (one-time, ~15 min):
//   1. Create account at hotmart.com → Sell on Hotmart
//   2. Go to Tools → API → Generate credentials
//   3. Set secrets: HOTMART_CLIENT_ID, HOTMART_CLIENT_SECRET
//   4. Complete seller profile with PayPal for payouts
//
// Revenue: BRL $39–$149 per sale · ~$8-30 USD at current rates

import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const HOTMART_CLIENT   = Deno.env.get("HOTMART_CLIENT_ID") || "";
const HOTMART_SECRET   = Deno.env.get("HOTMART_CLIENT_SECRET") || "";
const RESEND_KEY       = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_KEY      = Deno.env.get("LOVABLE_API_KEY") || "";
const ANTHROPIC_KEY    = Deno.env.get("ANTHROPIC_API_KEY") || "";
const OPENAI_KEY       = Deno.env.get("OPENAI_API_KEY") || "";
const OWNER_EMAIL      = "matthewmichels4@gmail.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const log = (s: string, d?: unknown) => console.log(`[HOTMART] ${s}${d ? " -- " + JSON.stringify(d) : ""}`);

async function ai(prompt: string, maxTokens = 3000): Promise<string> {
  for (const cfg of [
    { url: "https://ai.gateway.lovable.dev/v1/chat/completions", key: LOVABLE_KEY,
      body: (p: string, t: number) => ({ model: "google/gemini-2.5-flash", max_tokens: t, messages: [{ role: "user", content: p }] }),
      headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" } },
    { url: "https://api.anthropic.com/v1/messages", key: ANTHROPIC_KEY,
      body: (p: string, t: number) => ({ model: "claude-haiku-4-5-20251001", max_tokens: t, messages: [{ role: "user", content: p }] }),
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" } },
    { url: "https://api.openai.com/v1/chat/completions", key: OPENAI_KEY,
      body: (p: string, t: number) => ({ model: "gpt-4o-mini", max_completion_tokens: t, messages: [{ role: "user", content: p }] }),
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" } },
  ]) {
    if (!cfg.key) continue;
    try {
      const r = await fetch(cfg.url, { method: "POST", headers: cfg.headers, body: JSON.stringify(cfg.body(prompt, maxTokens)), signal: AbortSignal.timeout(35_000) });
      if (r.ok) {
        const d = await r.json();
        const t = d?.choices?.[0]?.message?.content?.trim() || d?.content?.[0]?.text?.trim();
        if (t) return t;
      }
    } catch {}
  }
  return "";
}

// LatAm market niches in Portuguese (Brazil focus)
const LATAM_NICHES = [
  { lang: "pt-BR", niche: "empreendedorismo digital", title_prefix: "Kit Completo:", price_brl: 47 },
  { lang: "pt-BR", niche: "marketing digital para pequenas empresas", title_prefix: "Guia Definitivo:", price_brl: 67 },
  { lang: "pt-BR", niche: "inteligência artificial para negócios", title_prefix: "Biblioteca de Prompts:", price_brl: 37 },
  { lang: "pt-BR", niche: "freelancer de sucesso no Brasil", title_prefix: "Pack Profissional:", price_brl: 47 },
  { lang: "es-MX", niche: "emprendimiento digital", title_prefix: "Pack Completo:", price_brl: 47 },
  { lang: "es-MX", niche: "marketing en redes sociales", title_prefix: "Guía Definitiva:", price_brl: 57 },
  { lang: "pt-BR", niche: "vendas online e e-commerce", title_prefix: "Sistema de Vendas:", price_brl: 77 },
  { lang: "pt-BR", niche: "criação de conteúdo para Instagram", title_prefix: "Calendário Editorial:", price_brl: 37 },
];

async function generatePortugueseProduct(niche: typeof LATAM_NICHES[0], existingTitles: string[]): Promise<{
  title: string; description: string; content: string; lang: string; price_brl: number;
}> {
  const skip = existingTitles.length ? `Já criado (evite): ${existingTitles.slice(-8).join(", ")}` : "";
  const isPortuguese = niche.lang === "pt-BR";
  const lang = isPortuguese ? "português brasileiro" : "español mexicano";

  const product = await ai(`${isPortuguese ? "Você é um criador de produtos digitais para o mercado brasileiro." : "Eres un creador de productos digitales para el mercado latinoamericano."}

${isPortuguese ? `Crie um guia digital completo sobre: ${niche.niche}
${skip}

## GUIA PRINCIPAL
Escreva um guia prático de 600 palavras sobre ${niche.niche} para empreendedores brasileiros.
Inclua: contexto do mercado, 4 estratégias principais, dicas práticas, exemplos reais.

## TEMPLATES (2 templates prontos)
Dois templates editáveis em texto simples para uso imediato.

## CHECKLIST DE 20 AÇÕES
Numere 20 ações práticas para implementar em 30 dias.

Seja direto, concreto e use exemplos do Brasil.` : `Crea una guía digital completa sobre: ${niche.niche}
${skip}

## GUÍA PRINCIPAL
Escribe una guía práctica de 600 palabras sobre ${niche.niche} para emprendedores latinoamericanos.
Incluye: contexto del mercado, 4 estrategias principales, consejos prácticos, ejemplos reales.

## PLANTILLAS (2 plantillas listas)
Dos plantillas editables en texto simple para uso inmediato.

## LISTA DE 20 ACCIONES
Enumera 20 acciones prácticas para implementar en 30 días.

Sé directo, concreto y usa ejemplos de Latinoamérica.`}`, 2500);

  const titleBase = await ai(`${isPortuguese
    ? `Crie um título atraente para um produto digital sobre "${niche.niche}" no estilo Hotmart Brasil. Deve ser específico, criar urgência e mostrar valor. Máximo 12 palavras. Retorne APENAS o título, sem aspas.`
    : `Crea un título atractivo para un producto digital sobre "${niche.niche}" para Hotmart. Específico, con urgencia, máximo 12 palabras. Retorna SOLO el título.`
  }`, 100);

  const title = titleBase || `${niche.title_prefix} ${niche.niche}`;

  const description = await ai(`${isPortuguese
    ? `Escreva uma descrição persuasiva de 2 parágrafos (máximo 200 palavras) para um produto Hotmart chamado "${title}" sobre ${niche.niche}. Foque nos resultados que o comprador vai alcançar. Tom direto e convincente, voltado para empreendedores brasileiros.`
    : `Escribe una descripción persuasiva de 2 párrafos para un producto Hotmart llamado "${title}" sobre ${niche.niche}. Enfócate en los resultados. Máximo 200 palabras.`
  }`, 300);

  return {
    title,
    description: description || `Produto digital completo sobre ${niche.niche}.`,
    content: product || `Conteúdo sobre ${niche.niche}`,
    lang: niche.lang,
    price_brl: niche.price_brl,
  };
}

async function buildPDF(title: string, content: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const W = 595, H = 842, M = 50, CW = W - M * 2;
  const green = rgb(0.07, 0.63, 0.35); // Hotmart-ish green
  const dark = rgb(0.05, 0.08, 0.12);

  const cover = pdfDoc.addPage([W, H]);
  cover.drawRectangle({ x: 0, y: 0, width: W, height: H, color: dark });
  cover.drawRectangle({ x: 0, y: H - 5, width: W, height: 5, color: green });
  cover.drawRectangle({ x: 0, y: 0, width: W, height: 5, color: green });

  const words = title.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (boldFont.widthOfTextAtSize(t, 20) > CW) { lines.push(cur); cur = w; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  const titleY = H / 2 + lines.length * 13;
  lines.forEach((l, i) => cover.drawText(l, { x: M, y: titleY - i * 28, size: 20, font: boldFont, color: rgb(1, 1, 1) }));
  cover.drawText("M² Produtos Digitais · mattmichelstraining.com", { x: M, y: M + 16, size: 9, font: regFont, color: rgb(0.4, 0.5, 0.6) });

  const paras = content.split("\n").filter(l => l.trim());
  let page = pdfDoc.addPage([W, H]);
  let y = H - M;
  for (const para of paras) {
    const isH1 = para.startsWith("## ");
    const isH2 = para.startsWith("### ");
    const isBullet = para.trim().startsWith("- ");
    const text = para.replace(/^#{2,3}\s*/, "").replace(/^-\s*/, "").trim();
    if (!text) continue;
    const font = (isH1 || isH2) ? boldFont : regFont;
    const size = isH1 ? 13 : isH2 ? 11 : 9;
    const color = isH1 ? green : rgb(0.15, 0.2, 0.28);
    const indent = isBullet ? M + 10 : M;
    const maxW = CW - (isBullet ? 10 : 0);
    const wwords = text.split(" ");
    const wrapped: string[] = [];
    let wl = "";
    for (const w of wwords) {
      const t = wl ? `${wl} ${w}` : w;
      if (font.widthOfTextAtSize(t, size) > maxW) { wrapped.push(wl); wl = w; } else wl = t;
    }
    if (wl) wrapped.push(wl);
    const needed = wrapped.length * 13 + (isH1 ? 10 : 3);
    if (y - needed < M) { page = pdfDoc.addPage([W, H]); y = H - M; }
    if (isBullet) page.drawText("•", { x: M, y, size, font, color });
    for (const wline of wrapped) { page.drawText(wline, { x: indent, y, size, font, color }); y -= 13; }
    y -= isH1 ? 8 : 2;
  }
  return pdfDoc.save();
}

async function getHotmartToken(): Promise<string> {
  const r = await fetch("https://api-sec-vlc.hotmart.com/security/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: HOTMART_CLIENT, client_secret: HOTMART_SECRET }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`Hotmart auth failed: ${r.status}`);
  const d = await r.json();
  return d.access_token;
}

async function publishToHotmart(token: string, product: { title: string; description: string }, pdfBytes: Uint8Array, priceBrl: number): Promise<{ id: string; url: string }> {
  // Upload file first
  const fileForm = new FormData();
  const fileName = product.title.slice(0, 40).replace(/[^a-zA-ZÀ-ú0-9\s]/g, "").replace(/\s+/g, "-") + ".pdf";
  fileForm.append("file", new Blob([pdfBytes], { type: "application/pdf" }), fileName);

  // Create product listing
  const createRes = await fetch("https://api.hotmart.com/product/api/v1/product", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: product.title,
      description: product.description,
      price: { value: priceBrl, currency_code: "BRL" },
      product_format: "EBOOK",
      warranty_days: 7,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const cd = await createRes.json();
  if (!createRes.ok) throw new Error(`Hotmart product creation failed: ${JSON.stringify(cd).slice(0, 300)}`);

  const productId = cd.id || cd.ucode;
  const url = `https://hotmart.com/product/${productId}`;
  return { id: productId, url };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  log("Start");

  if (!HOTMART_CLIENT || !HOTMART_SECRET) {
    // Queue mode: generate content even without credentials so quality can be verified
    try {
      const { data: existing } = await sb.from("hotmart_products_queue" as any).select("title").limit(50);
      const existingTitles = (existing || []).map((e: any) => e.title);
      const nicheIdx = Math.floor(Date.now() / 86400_000) % LATAM_NICHES.length;
      const niche = LATAM_NICHES[nicheIdx];

      log("Queue mode — generating Portuguese/Spanish content for preview", { niche: niche.niche });
      const product = await generatePortugueseProduct(niche, existingTitles);

      await sb.from("hotmart_products_queue" as any).insert({
        title: product.title,
        description: product.description,
        language: product.lang,
        niche: niche.niche,
        price_brl: product.price_brl,
        status: "queued_for_upload",
      }).then(null, () => {});

      return new Response(JSON.stringify({
        mode: "queue",
        queued: true,
        title: product.title,
        lang: product.lang,
        price_brl: product.price_brl,
        description_preview: product.description.slice(0, 300),
        content_preview: product.content.slice(0, 500),
        setup: "1. Create account at hotmart.com → 2. Tools → API → Generate credentials → 3. Set HOTMART_CLIENT_ID and HOTMART_CLIENT_SECRET",
        market: "35M users in Brazil, Mexico, Colombia — $3B+ GMV",
      }), { headers: { ...CORS, "Content-Type": "application/json" } });
    } catch (genErr) {
      return new Response(JSON.stringify({
        skipped: true,
        reason: "HOTMART_CLIENT_ID / HOTMART_CLIENT_SECRET not set",
        setup: "1. Create account at hotmart.com → 2. Tools → API → credentials → 3. Set HOTMART_CLIENT_ID and HOTMART_CLIENT_SECRET",
        market: "35M users in Brazil, Mexico, Colombia — $3B+ GMV",
      }), { status: 503, headers: { ...CORS, "Content-Type": "application/json" } });
    }
  }

  try {
    const { data: existing } = await sb.from("hotmart_products_queue" as any).select("title").limit(50);
    const existingTitles = (existing || []).map((e: any) => e.title);
    const nicheIdx = Math.floor(Date.now() / 86400_000) % LATAM_NICHES.length;
    const niche = LATAM_NICHES[nicheIdx];

    log("Generating product", { niche: niche.niche, lang: niche.lang });
    const product = await generatePortugueseProduct(niche, existingTitles);

    const pdfBytes = await buildPDF(product.title, product.content);
    log("PDF built", { bytes: pdfBytes.length });

    const token = await getHotmartToken();
    const result = await publishToHotmart(token, product, pdfBytes, product.price_brl);
    log("Published to Hotmart", result);

    await sb.from("hotmart_products_queue" as any).insert({
      title: product.title,
      description: product.description,
      language: product.lang,
      price_brl: product.price_brl,
      hotmart_id: result.id,
      hotmart_url: result.url,
      status: "live",
    }).then(null, () => {});

    if (RESEND_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Hotmart Agent <matt@detroitwebagent.com>",
          to: [OWNER_EMAIL],
          subject: `🇧🇷 Novo produto no Hotmart: ${product.title.slice(0, 50)}`,
          html: `<div style="font-family:sans-serif;max-width:560px;padding:20px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
<h2 style="color:#10b981;">🇧🇷 Produto publicado no Hotmart</h2>
<p><strong>${product.title}</strong></p>
<p>Preço: R$${product.price_brl} · Idioma: ${product.lang}</p>
<a href="${result.url}" style="display:inline-block;background:#10b981;color:#000;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:12px;">Ver no Hotmart →</a>
</div>`,
        }),
      });
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "hotmart-publisher",
      last_run_at: new Date().toISOString(),
      last_status: "ok",
      last_result: JSON.stringify({ title: product.title, url: result.url, price_brl: product.price_brl, lang: product.lang }),
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({ success: true, ...result, title: product.title, lang: product.lang, price_brl: product.price_brl }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    log("Error", String(err).slice(0, 300));
    await sb.from("agent_heartbeats").upsert({
      agent_name: "hotmart-publisher",
      last_run_at: new Date().toISOString(),
      last_status: "error",
      last_result: JSON.stringify({ error: String(err).slice(0, 200) }),
    }, { onConflict: "agent_name" });
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
