// teachers-pay-teachers-queue — Autonomous TpT educational product factory
//
// Runs DAILY 6am UTC via cron.
// Generates K-12 educational resources and queues them for Teachers Pay Teachers.
// TpT has 7M+ teacher-buyers, $500M+ annual GMV, premium prices for quality content.
//
// Strategy: AI creates worksheet packs, lesson plans, activity bundles.
// Matt sets up TpT seller account → batch uploads from this queue.
// I keep the queue stocked 24/7. He approves and uploads when ready.
//
// Revenue: $3.50–$12.00 per resource · 80% royalty on $3+ items
// Top sellers: math worksheets, grammar packs, reading comprehension, STEM activities

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_KEY    = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_KEY   = Deno.env.get("LOVABLE_API_KEY") || "";
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const OPENAI_KEY    = Deno.env.get("OPENAI_API_KEY") || "";
const OWNER_EMAIL   = "matthewmichels4@gmail.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const log = (s: string, d?: unknown) => console.log(`[TPT-QUEUE] ${s}${d ? " -- " + JSON.stringify(d) : ""}`);

async function ai(prompt: string, maxTokens = 3000): Promise<string> {
  for (const [url, key, headers, bodyFn] of [
    ["https://ai.gateway.lovable.dev/v1/chat/completions", LOVABLE_KEY,
      { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
      (p: string, t: number) => ({ model: "google/gemini-2.5-flash", max_tokens: t, messages: [{ role: "user", content: p }] })],
    ["https://api.anthropic.com/v1/messages", ANTHROPIC_KEY,
      { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      (p: string, t: number) => ({ model: "claude-haiku-4-5-20251001", max_tokens: t, messages: [{ role: "user", content: p }] })],
    ["https://api.openai.com/v1/chat/completions", OPENAI_KEY,
      { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      (p: string, t: number) => ({ model: "gpt-4o-mini", max_completion_tokens: t, messages: [{ role: "user", content: p }] })],
  ] as any[]) {
    if (!key) continue;
    try {
      const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(bodyFn(prompt, maxTokens)), signal: AbortSignal.timeout(35_000) });
      if (r.ok) {
        const d = await r.json();
        const t = d?.choices?.[0]?.message?.content?.trim() || d?.content?.[0]?.text?.trim();
        if (t) return t;
      }
    } catch {}
  }
  return "";
}

// TpT category rotation — covers best-selling niches
const TPT_NICHES = [
  { subject: "Math", grade: "3rd Grade", topic: "multiplication and division facts", type: "worksheet_pack", price: 4.00 },
  { subject: "ELA", grade: "2nd Grade", topic: "reading comprehension passages with questions", type: "worksheet_pack", price: 4.50 },
  { subject: "Science", grade: "5th Grade", topic: "ecosystems and food webs", type: "activity_pack", price: 5.00 },
  { subject: "Math", grade: "Kindergarten", topic: "counting and number recognition", type: "worksheet_pack", price: 3.50 },
  { subject: "ELA", grade: "4th Grade", topic: "figurative language (simile, metaphor, idiom)", type: "lesson_plan", price: 6.00 },
  { subject: "Social Studies", grade: "1st Grade", topic: "community helpers and jobs", type: "activity_pack", price: 4.00 },
  { subject: "Math", grade: "6th Grade", topic: "fractions, decimals, and percentages", type: "worksheet_pack", price: 5.00 },
  { subject: "Science", grade: "3rd Grade", topic: "animal adaptations and habitats", type: "activity_pack", price: 4.50 },
  { subject: "ELA", grade: "5th Grade", topic: "narrative writing prompts", type: "worksheet_pack", price: 4.00 },
  { subject: "Math", grade: "1st Grade", topic: "addition and subtraction to 20", type: "worksheet_pack", price: 3.50 },
  { subject: "STEM", grade: "4th Grade", topic: "simple machines and engineering challenges", type: "activity_pack", price: 6.50 },
  { subject: "ELA", grade: "3rd Grade", topic: "context clues and vocabulary", type: "worksheet_pack", price: 4.00 },
];

async function generateResource(niche: typeof TPT_NICHES[0], existingTitles: string[]): Promise<{
  title: string; subject: string; grade: string; resource_type: string; price: number;
  description: string; tags: string[]; content: string;
}> {
  const skipList = existingTitles.length ? `Skip topics already created:\n${existingTitles.slice(-15).join("\n")}` : "";

  const content = await ai(`Create a complete, print-ready educational resource for Teachers Pay Teachers.

Subject: ${niche.subject}
Grade Level: ${niche.grade}
Topic: ${niche.topic}
Resource Type: ${niche.type.replace("_", " ")}
${skipList}

Create a COMPLETE, ready-to-use resource with:

# TITLE
Compelling TpT title (specific, searchable, 8-12 words)

# TEACHER INSTRUCTIONS
Step-by-step teacher guide (setup, materials, timing, differentiation tips)

# STUDENT ACTIVITY / WORKSHEET CONTENT
${niche.type === "worksheet_pack" ? `
Create 3 complete worksheets:
- Worksheet A: Foundational (below grade level support)
- Worksheet B: On Grade Level (standard)
- Worksheet C: Challenge/Extension (above grade level)
Each worksheet: 10-15 problems/questions with clear instructions, visual cues, answer space` : ""}
${niche.type === "activity_pack" ? `
Create 3 activities:
- Warm-up activity (10 min) with materials and instructions
- Main activity (30 min) with step-by-step procedure
- Extension challenge with real-world connection` : ""}
${niche.type === "lesson_plan" ? `
Complete lesson plan:
- Learning objectives (3 measurable goals)
- Materials needed
- Hook/Anticipatory Set (10 min)
- Direct Instruction (15 min)
- Guided Practice (15 min)
- Independent Practice (15 min)
- Closure and Assessment (10 min)
- Differentiation strategies
- Assessment rubric` : ""}

# ANSWER KEY
Complete answer key for all problems/activities

Make this genuinely useful. Teachers will rate it 1-5 stars. 4.5+ stars = top seller.`, 4000);

  if (!content) throw new Error("AI returned empty content");

  // Extract title from content
  const titleMatch = content.match(/# TITLE\s*\n+(.+)/);
  const extractedTitle = titleMatch ? titleMatch[1].trim() : `${niche.grade} ${niche.subject}: ${niche.topic} ${niche.type.replace("_", " ")}`;

  const description = await ai(`Write a compelling TpT product description for this resource:
Title: "${extractedTitle}"
Subject: ${niche.subject}, Grade: ${niche.grade}, Topic: ${niche.topic}

Write 3 paragraphs (plain text, no markdown, under 300 words):
1. What's included and who it's for
2. Specific skills and standards addressed (mention Common Core or state standards where applicable)
3. How it saves teacher prep time and what students will achieve`, 400);

  const tags = [
    niche.grade.toLowerCase().replace(" ", "-"),
    niche.subject.toLowerCase(),
    niche.topic.split(" ")[0].toLowerCase(),
    niche.type.replace("_", "-"),
    "print-and-go",
    "no-prep",
    "common-core",
    "worksheet",
    "teacher-resource",
  ].slice(0, 20);

  return {
    title: extractedTitle,
    subject: niche.subject,
    grade: niche.grade,
    resource_type: niche.type,
    price: niche.price,
    description: description || `${niche.grade} ${niche.subject} resource covering ${niche.topic}.`,
    tags,
    content,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const count = Math.min(parseInt(url.searchParams.get("count") || "3"), 10);

  log(`Generating ${count} TpT products`);

  const created: string[] = [];
  const failed: string[] = [];

  const runWork = async () => {
    const { data: existing } = await sb.from("tpt_product_queue" as any)
      .select("title").limit(100);
    const existingTitles = (existing || []).map((e: any) => e.title);

    for (let i = 0; i < count; i++) {
      try {
        const { data: freshExisting } = await sb.from("tpt_product_queue" as any)
          .select("title").limit(100);
        const allTitles = (freshExisting || []).map((e: any) => e.title);

        const nicheIdx = (Math.floor(Date.now() / 3600_000) + i) % TPT_NICHES.length;
        const niche = TPT_NICHES[nicheIdx];

        log(`Generating: ${niche.grade} ${niche.subject} (${niche.type})`);

        const resource = await generateResource(niche, allTitles);

        await sb.from("tpt_product_queue" as any).insert({
          title: resource.title,
          subject: resource.subject,
          grade_level: resource.grade,
          resource_type: resource.resource_type,
          price_usd: resource.price,
          description: resource.description,
          tags: resource.tags,
          content_text: resource.content,
          status: "ready_to_upload",
          upload_platform: "teachers_pay_teachers",
        });

        created.push(resource.title);
        log(`Created: ${resource.title}`);
      } catch (err) {
        log(`Failed item ${i + 1}`, String(err).slice(0, 200));
        failed.push(String(err).slice(0, 100));
      }
    }

    // Summary email
    if (RESEND_KEY && created.length > 0) {
      const { data: queueCount } = await sb.from("tpt_product_queue" as any)
        .select("id", { count: "exact", head: true }).eq("status", "ready_to_upload");

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "TpT Agent <matt@detroitwebagent.com>",
          to: [OWNER_EMAIL],
          subject: `📚 ${created.length} TpT resources ready to upload`,
          html: `<div style="font-family:sans-serif;max-width:560px;padding:20px;background:#0f172a;color:#e2e8f0;border-radius:12px;">
<h2 style="color:#8b5cf6;">📚 TpT Queue Update</h2>
<p>${created.length} new resources ready to upload to Teachers Pay Teachers:</p>
<ol style="padding-left:20px;">${created.map(t => `<li style="margin-bottom:6px;">${t}</li>`).join("")}</ol>
<p style="color:#94a3b8;">Total queue: ${(queueCount as any)?.count || "?"} items ready to upload</p>
<p style="color:#64748b;font-size:12px;">Setup: Create account at teacherspayteachers.com → Sell on TpT → Bulk upload from queue</p>
</div>`,
        }),
      });
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "teachers-pay-teachers-queue",
      last_run_at: new Date().toISOString(),
      last_status: created.length > 0 ? "ok" : "error",
      last_result: JSON.stringify({ created: created.length, failed: failed.length, titles: created }),
    }, { onConflict: "agent_name" });
  };

  // @ts-expect-error EdgeRuntime is Supabase global
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
    // @ts-expect-error
    EdgeRuntime.waitUntil(runWork());
    return new Response(JSON.stringify({ dispatched: true, count, message: `Generating ${count} TpT resources in background` }), {
      status: 202, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  await runWork();
  return new Response(JSON.stringify({ success: true, created: created.length, failed: failed.length, titles: created }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
