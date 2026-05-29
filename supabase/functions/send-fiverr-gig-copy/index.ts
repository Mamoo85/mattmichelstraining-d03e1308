// send-fiverr-gig-copy — One-shot: emails Matt all 10 Fiverr gig listings + sample images
// POST {} → generates 10 portfolio images in parallel, sends one big email with all copy
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_KEY   = Deno.env.get("RESEND_API_KEY") || "";
const OPENAI_KEY   = Deno.env.get("OPENAI_API_KEY") || "";
const OWNER_EMAIL  = "matthewmichels4@gmail.com";

const sb  = createClient(SUPABASE_URL, SERVICE_KEY);
const log = (s: string) => console.log(`[GIG-COPY] ${s}`);

// ── 10 gig definitions ─────────────────────────────────────────────────────────
const GIGS = [
  {
    id: "youtube_thumbnail",
    title: "I will create eye-catching YouTube thumbnails using AI",
    description: `Stop losing clicks to boring thumbnails. I generate high-quality, scroll-stopping YouTube thumbnails using cutting-edge AI in 4 styles: Dramatic (dark/cinematic), Clean (minimal/professional), Gaming (neon/RGB), and Tutorial (friendly/educational).

Just tell me your video title, channel niche, and preferred style — I deliver a crisp 1536×1024 PNG file, ready to upload directly to YouTube. No stock photos, no templates — every thumbnail is generated fresh for your video.

Fast delivery. High quality. Unlimited revisions on Standard/Premium.`,
    packages: [
      "BASIC $10 — 1 thumbnail, 1 style, 1-day delivery, 2 revisions",
      "STANDARD $25 — 3 thumbnails, any styles, 1-day delivery, unlimited revisions",
      "PREMIUM $50 — 5 thumbnails + 3 style variants each, same-day delivery, unlimited revisions",
    ],
    requirements: "1. Video title\n2. Channel niche (gaming, finance, fitness, etc.)\n3. Preferred style: dramatic / clean / gaming / tutorial\n4. Any specific colors or elements to include",
    tags: "youtube thumbnail, thumbnail design, youtube, video thumbnail, AI thumbnail",
    imagePrompt: "Professional YouTube video thumbnail portfolio mockup — dramatic cinematic style, vibrant neon colors, dark background, bold composition, showing multiple thumbnail examples in a clean product display grid, ultra-high quality sample portfolio image",
  },
  {
    id: "blog_post",
    title: "I will write an SEO-optimized blog post or article using AI",
    description: `Get professionally written blog posts delivered in under 1 hour — not 3–7 days like typical writers. I use advanced AI to create engaging, SEO-friendly content that reads naturally and ranks.

Every post includes an attention-grabbing headline, strong intro that hooks the reader, 3 value-packed sections with subheadings, and a clear call-to-action. Formatted in clean HTML or plain text — your choice.

Perfect for businesses, bloggers, and content marketers who need consistent, high-quality content fast.`,
    packages: [
      "BASIC $15 — 500-word post, 1-day delivery, 2 revisions",
      "STANDARD $35 — 1,500-word post + SEO keyword integration, 1-day delivery, unlimited revisions",
      "PREMIUM $75 — 3,000-word in-depth article + meta description + 3 title variations, same-day, unlimited revisions",
    ],
    requirements: "1. Topic or working title\n2. Target audience\n3. Any keywords to include\n4. Tone: professional / casual / authoritative\n5. Your website URL (optional, for brand voice matching)",
    tags: "blog post, article writing, SEO content, blog writing, content writing",
    imagePrompt: "Professional blog article displayed on a modern laptop screen, clean website design, well-formatted content with headings and paragraphs, high-quality copywriting sample, digital marketing aesthetic, studio lighting product mockup",
  },
  {
    id: "social_captions",
    title: "I will create 30 days of social media captions for your brand",
    description: `Never stare at a blank screen again. I deliver a full month of ready-to-post social media captions in under 24 hours.

Your 30-post pack includes 10 promotional posts, 10 educational/tips posts, and 10 engaging/question posts — with relevant hashtags for every single post. Under 280 characters per caption so it works on all platforms.

Hand it to your social media manager or post directly — it's ready to go.`,
    packages: [
      "BASIC $15 — 10 captions, 1 platform focus, 1-day delivery",
      "STANDARD $35 — 30 captions + hashtags, multi-platform, 1-day delivery, unlimited revisions",
      "PREMIUM $75 — 30 captions + hashtags + content calendar + posting schedule, same-day, unlimited revisions",
    ],
    requirements: "1. Business name and industry\n2. Target audience\n3. Brand voice: fun / professional / bold / friendly\n4. Products or services to highlight\n5. Platforms: Instagram / Facebook / LinkedIn / Twitter",
    tags: "social media captions, instagram captions, social media content, content creation, hashtags",
    imagePrompt: "Smartphone screen showing a polished Instagram feed with 9 beautifully curated posts, professional brand aesthetic, consistent visual style, engagement metrics visible, social media content portfolio mockup on clean white desk",
  },
  {
    id: "press_release",
    title: "I will write a professional press release for your business",
    description: `Agency-quality press releases in hours, not weeks — at a fraction of the cost. I write newsworthy press releases formatted exactly how journalists and wire services expect them.

Every press release includes: FOR IMMEDIATE RELEASE header, compelling headline and subheadline, 5W lead paragraph, 2–3 body paragraphs with quotes, company boilerplate, and contact information block.

Ready to submit to PRWeb, GlobeNewswire, or any local media outlet.`,
    packages: [
      "BASIC $20 — 1 press release, 1-day delivery, 2 revisions",
      "STANDARD $45 — 2 press releases + distribution tips, 1-day delivery, unlimited revisions",
      "PREMIUM $99 — 3 press releases + SEO-optimized version + media pitch email, same-day, unlimited revisions",
    ],
    requirements: "1. Company name and industry\n2. Announcement topic (product launch, award, expansion, etc.)\n3. Key facts and figures\n4. Spokesperson name and title\n5. Company contact information",
    tags: "press release, PR writing, press release writing, public relations, news release",
    imagePrompt: "Professional press release document on a clean executive desk, crisp typography, official letterhead, corporate business announcement, FOR IMMEDIATE RELEASE header visible, professional PR writing portfolio sample",
  },
  {
    id: "sales_script",
    title: "I will write cold email sequences and sales scripts that convert",
    description: `Your outreach is only as good as your words. I write cold email sequences and phone scripts that get replies — using proven copywriting frameworks (AIDA, PAS, pattern interrupt).

Email sequences include subject lines that get opened, personalized openers, value-focused body copy, and a clear CTA. Phone scripts include a 30-second cold call opener with pattern interrupt, follow-up call script, and the top 5 objection rebuttals word for word.`,
    packages: [
      "BASIC $25 — 5-email cold sequence, 1-day delivery, 2 revisions",
      "STANDARD $55 — 10-email sequence + LinkedIn message templates, 1-day delivery, unlimited revisions",
      "PREMIUM $120 — Full outreach kit: 10 emails + phone scripts + objection handling + subject line variations, same-day, unlimited revisions",
    ],
    requirements: "1. Your product or service\n2. Target customer (title, industry, company size)\n3. Main value proposition / pain point you solve\n4. Your name and company name\n5. Any competitors you want to reference (optional)",
    tags: "cold email, sales script, email sequence, cold outreach, sales copywriting",
    imagePrompt: "Laptop screen showing a polished cold email sequence in an email client, professional sales outreach, clean email marketing template, business development tools, conversion-focused copywriting portfolio mockup",
  },
  {
    id: "video_script",
    title: "I will write YouTube video scripts optimized for retention and engagement",
    description: `A great video starts with a great script. I write short-form and long-form video scripts designed to hook viewers in the first 3 seconds and keep them watching to the end.

Every script includes a 3-second attention hook, structured body with natural flow, on-screen text and B-roll suggestions, and a strong call-to-action. Works for talking-head videos, faceless channels, tutorials, and product demos.`,
    packages: [
      "BASIC $20 — 1 short-form script (60 sec / ~150 words), 1-day delivery",
      "STANDARD $40 — 3 short-form scripts OR 1 long-form (8–10 min), 1-day delivery, unlimited revisions",
      "PREMIUM $80 — 5 short-form + 1 long-form + hook variations + thumbnail concept, same-day, unlimited revisions",
    ],
    requirements: "1. Video topic\n2. Target platform: YouTube / TikTok / Instagram Reels\n3. Your channel style or niche\n4. Desired video length\n5. Key points you must cover (optional)",
    tags: "video script, youtube script, script writing, youtube, content creator",
    imagePrompt: "Professional video script pages on a filmmaker's desk, clapperboard nearby, YouTube content creation planning, well-formatted script with scene notes and timing marks, video production portfolio sample",
  },
  {
    id: "proposal",
    title: "I will write a winning business proposal or project pitch",
    description: `Win more clients with proposals that look polished and read persuasively. I generate professional business proposals in under an hour — the kind that make prospects say yes.

Every proposal includes an executive summary, scope of work, deliverables and timeline, investment breakdown, social proof section, and professional terms. Delivered as formatted HTML or clean text, ready to paste into your proposal tool or send directly.`,
    packages: [
      "BASIC $30 — 1 proposal, 1-day delivery, 2 revisions",
      "STANDARD $65 — 2 proposals customized per project, 1-day delivery, unlimited revisions",
      "PREMIUM $120 — 3 proposals + cover letter + follow-up email sequence, same-day, unlimited revisions",
    ],
    requirements: "1. Client name and company\n2. Project scope (what you're proposing to do)\n3. Your company name and key selling points\n4. Timeline and budget (if known)\n5. Any specific terms or conditions to include",
    tags: "business proposal, proposal writing, project proposal, pitch document, business pitch",
    imagePrompt: "Sleek professional business proposal document on an executive conference table, clean corporate design, well-structured sections visible, investment breakdown table, premium business pitch portfolio mockup",
  },
  {
    id: "website_copy",
    title: "I will rewrite your website copy to convert more visitors into customers",
    description: `Your website is your #1 salesperson — is it doing its job? I rewrite your homepage and key pages with clear, compelling copy that turns visitors into leads.

Every rewrite includes a hero headline + subheadline, 3 value propositions with supporting copy, social proof section, FAQ section with 6 questions, and strong calls-to-action throughout. Written to rank in Google AND convert real visitors. No fluff, no jargon.`,
    packages: [
      "BASIC $35 — Homepage rewrite, 1-day delivery, 2 revisions",
      "STANDARD $75 — 5-page rewrite (homepage, about, services, contact + 1 more), 2-day delivery, unlimited revisions",
      "PREMIUM $150 — Full site (up to 10 pages) + SEO keywords + meta descriptions, 3-day delivery, unlimited revisions",
    ],
    requirements: "1. Your current website URL (or paste existing copy)\n2. Business description and main offer\n3. Target customer\n4. Your top 3 competitive advantages\n5. Tone: professional / conversational / authoritative",
    tags: "website copy, web copywriting, landing page copy, website content, SEO copywriting",
    imagePrompt: "Laptop showing a high-converting website landing page with compelling headline, clean modern design, clear value propositions, professional copywriting, conversion-optimized layout, website copywriting portfolio showcase",
  },
  {
    id: "pod_design",
    title: "I will design unique print-on-demand artwork for Etsy, Redbubble, and Merch",
    description: `Fresh designs every time — no templates, no stock art. I generate original print-on-demand artwork using AI, perfect for mugs, t-shirts, tote bags, and phone cases.

Each design is original, high-resolution, print-ready PNG, commercially licensed for POD use, and delivered with a white background for easy upload to Printify, Printful, or Redbubble.

Great for Etsy shop owners who want to expand their catalog fast.`,
    packages: [
      "BASIC $15 — 3 unique designs, 1-day delivery, 2 revisions",
      "STANDARD $35 — 10 designs, various styles/niches, 1-day delivery, unlimited revisions",
      "PREMIUM $75 — 25 designs + niche research + recommended products list, 2-day delivery, unlimited revisions",
    ],
    requirements: "1. Your niche or theme (dog lover, nurse humor, camping, etc.)\n2. Preferred style: bold / minimal / illustrated / vintage\n3. Any colors to include or avoid\n4. Any text/words to include in designs\n5. Product type (t-shirt, mug, tote bag — affects composition)",
    tags: "print on demand, POD design, t-shirt design, etsy design, merch design",
    imagePrompt: "Collection of unique print-on-demand designs displayed on white t-shirts, mugs, and tote bags in a clean product mockup grid, original artwork samples, Etsy shop product photos, commercial print-ready designs portfolio",
  },
  {
    id: "brand_names",
    title: "I will generate creative business names and brand slogans",
    description: `Stuck on a name? I generate 10 unique, memorable business names + 5 catchy slogans tailored to your industry and brand personality — delivered in under 1 hour.

You get 10 original name ideas (mix of one-word, compound, invented, and descriptive styles), 5 matching slogans that are punchy and under 5 words, domain availability tips, and names chosen for memorability, spelling ease, and .com potential.

Perfect for new businesses, rebrands, side hustles, and product launches.`,
    packages: [
      "BASIC $10 — 10 names + 5 slogans, 1-day delivery, 2 revisions",
      "STANDARD $20 — 25 names + 10 slogans + domain availability guide, same-day delivery, unlimited revisions",
      "PREMIUM $45 — Full brand kit: 25 names + slogans + color palette description + logo concept brief + tagline variations, same-day, unlimited revisions",
    ],
    requirements: "1. Your industry or business type\n2. Brand vibe: fun / modern / serious / professional / quirky\n3. Keywords you'd like considered (optional)\n4. Names to AVOID (if any)\n5. Target market / customer",
    tags: "business name, brand name, company name, naming, brand identity",
    imagePrompt: "Brand identity mood board showing creative business name concepts, typography samples, color palette swatches, logo placeholder, naming brainstorm on clean white background, branding agency portfolio sample",
  },
];

// ── Generate one sample image ──────────────────────────────────────────────────
async function generateSampleImage(gig: typeof GIGS[0]): Promise<string | null> {
  if (!OPENAI_KEY) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: gig.imagePrompt,
        n: 1,
        size: "1536x1024",
        quality: "medium",
        output_format: "png",
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const data = await res.json();
    if (!data.data?.[0]?.b64_json) { log(`Image failed: ${gig.id}`); return null; }
    const bytes = Uint8Array.from(atob(data.data[0].b64_json), c => c.charCodeAt(0));
    try { await sb.storage.createBucket("fiverr-samples", { public: true }); } catch { }
    const path = `${gig.id}-sample-${Date.now()}.png`;
    const { error } = await sb.storage.from("fiverr-samples").upload(path, new Blob([bytes], { type: "image/png" }), { upsert: true });
    if (error) { log(`Upload failed: ${gig.id} — ${error.message}`); return null; }
    const url = `${SUPABASE_URL}/storage/v1/object/public/fiverr-samples/${path}`;
    log(`Image ready: ${gig.id} → ${url}`);
    return url;
  } catch (e) {
    log(`Image exception: ${gig.id} — ${String(e).slice(0, 100)}`);
    return null;
  }
}

// ── Build HTML for one gig ─────────────────────────────────────────────────────
function gigHtml(gig: typeof GIGS[0], imageUrl: string | null, index: number): string {
  const imgHtml = imageUrl
    ? `<img src="${imageUrl}" alt="${gig.title}" style="width:100%;border-radius:8px;margin-bottom:16px;display:block;" />`
    : `<div style="background:#1e293b;border-radius:8px;padding:20px;margin-bottom:16px;text-align:center;color:#64748b;font-size:12px;">Image generating... upload your own for now</div>`;

  return `
  <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:28px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
      <span style="background:#7c3aed;color:white;border-radius:50%;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;flex-shrink:0;">${index}</span>
      <strong style="color:#a78bfa;font-size:15px;">${gig.title}</strong>
    </div>

    ${imgHtml}

    <div style="margin-bottom:12px;">
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">GIG DESCRIPTION — paste this into Fiverr</div>
      <div style="background:#1e293b;border-radius:6px;padding:12px;font-size:12px;color:#cbd5e1;white-space:pre-wrap;line-height:1.6;">${gig.description}</div>
    </div>

    <div style="margin-bottom:12px;">
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">PACKAGES</div>
      ${gig.packages.map(p => `<div style="background:#1e293b;border-radius:6px;padding:10px;margin-bottom:6px;font-size:12px;color:#94a3b8;">${p}</div>`).join("")}
    </div>

    <div style="margin-bottom:12px;">
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">BUYER REQUIREMENTS — set these in Fiverr's requirements section</div>
      <div style="background:#1e293b;border-radius:6px;padding:12px;font-size:12px;color:#94a3b8;white-space:pre-wrap;">${gig.requirements}</div>
    </div>

    <div>
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">TAGS</div>
      <div style="font-size:12px;color:#60a5fa;">${gig.tags}</div>
    </div>
  </div>`;
}

// ── Main handler ───────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });

  // Reuse images already in storage — query for the latest file per gig ID
  log("Looking up existing sample images in storage...");
  const { data: files } = await sb.storage.from("fiverr-samples").list("", { limit: 200, sortBy: { column: "created_at", order: "desc" } });

  const imageUrls: (string | null)[] = GIGS.map(gig => {
    const match = (files || []).find(f => f.name.startsWith(`${gig.id}-sample-`));
    if (!match) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/fiverr-samples/${match.name}`;
  });

  const found = imageUrls.filter(Boolean).length;
  log(`Found ${found}/10 existing images`);

  // For any missing images, generate sequentially (not in parallel) to stay within memory limits
  for (let i = 0; i < GIGS.length; i++) {
    if (!imageUrls[i]) {
      log(`Generating missing image for: ${GIGS[i].id}`);
      imageUrls[i] = await generateSampleImage(GIGS[i]);
    }
  }

  const gigsHtml = GIGS.map((g, i) => gigHtml(g, imageUrls[i], i + 1)).join("");

  const html = `
  <div style="font-family:sans-serif;max-width:720px;margin:auto;padding:20px;background:#060d1a;color:#e2e8f0;">
    <div style="text-align:center;margin-bottom:32px;padding:24px;background:#0f172a;border-radius:12px;border:1px solid #7c3aed;">
      <h1 style="color:#a78bfa;margin:0 0 8px;font-size:22px;">Your 10 Fiverr Gigs — Ready to Post</h1>
      <p style="color:#64748b;margin:0;font-size:13px;">Copy the description, packages, and requirements for each gig. Use the sample image as your gig portfolio image.</p>
    </div>
    ${gigsHtml}
    <div style="text-align:center;padding:20px;background:#0f172a;border-radius:12px;border:1px solid #334155;">
      <p style="color:#64748b;font-size:12px;margin:0;">Fulfillment is live for all 10 gigs via <strong style="color:#e2e8f0;">fiverr-order-intake</strong>.<br/>Set up Gmail Apps Script to complete the automation loop.</p>
    </div>
  </div>`;

  let resendStatus = "no_key";
  let resendBody = "";
  if (RESEND_KEY) {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Fiverr Setup <matt@detroitwebagent.com>",
        to: [OWNER_EMAIL],
        subject: "Your 10 Fiverr Gigs — All Copy + Sample Images Ready to Post",
        html,
      }),
    });
    resendBody = await resendRes.text();
    resendStatus = `${resendRes.status} ${resendRes.ok ? "ok" : "FAILED"}`;
    log(`Resend ${resendStatus}: ${resendBody.slice(0, 300)}`);
  }

  return new Response(JSON.stringify({ ok: true, images_found: found, images_total: imageUrls.filter(Boolean).length, resend: resendStatus, resend_body: resendBody.slice(0, 300) }), {
    headers: { "Content-Type": "application/json" },
  });
});
