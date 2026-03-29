import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: any) =>
  console.log(`[AUTO-PRODUCTS] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

// Catalog of niche programs to auto-generate — sports × age × goal
const PROGRAM_CATALOG = [
  { title: "Football Combine Prep — 8 Weeks", sport: "football", level: "advanced", goal: "speed, power, combine drills", ageGroup: "16-18", price: 160 },
  { title: "Baseball Off-Season Power Block — 4 Weeks", sport: "baseball", level: "intermediate", goal: "rotational power, arm care, hip strength", ageGroup: "14-17", price: 80 },
  { title: "Varsity Wrestler Pre-Season — 6 Weeks", sport: "wrestling", level: "advanced", goal: "strength endurance, takedown power, cutting weight safely", ageGroup: "15-18", price: 120 },
  { title: "Basketball Off-Season Athleticism — 4 Weeks", sport: "basketball", level: "intermediate", goal: "vertical jump, lateral quickness, strength", ageGroup: "13-17", price: 80 },
  { title: "Soccer Speed & Conditioning — 4 Weeks", sport: "soccer", level: "intermediate", goal: "sprint speed, endurance, injury prevention", ageGroup: "12-16", price: 80 },
  { title: "ACL Return-to-Play Protocol — 8 Weeks", sport: "general", level: "beginner", goal: "ACL rehab, quad strength, movement confidence", ageGroup: "all", price: 160 },
  { title: "Volleyball Jump Training — 4 Weeks", sport: "volleyball", level: "intermediate", goal: "vertical jump, shoulder stability, court movement", ageGroup: "13-17", price: 80 },
  { title: "College Freshman Strength Base — 4 Weeks", sport: "general", level: "beginner", goal: "foundation strength, movement quality, college transition", ageGroup: "18+", price: 80 },
  { title: "Track & Field Speed Block — 4 Weeks", sport: "track", level: "intermediate", goal: "sprint mechanics, explosive starts, strength base", ageGroup: "14-18", price: 80 },
  { title: "Hockey Off-Season Power — 4 Weeks", sport: "hockey", level: "intermediate", goal: "hip power, skating strength, core stability", ageGroup: "14-18", price: 80 },
  { title: "Youth Athlete Movement Foundation — Ages 11-13", sport: "general", level: "beginner", goal: "movement quality, body awareness, fun athleticism", ageGroup: "11-13", price: 40 },
  { title: "Female Athlete Strength Program — 4 Weeks", sport: "general", level: "intermediate", goal: "ACL prevention, strength, confidence, power", ageGroup: "13-18", price: 80 },
  { title: "Quarterback Performance — 4 Weeks", sport: "football", level: "advanced", goal: "shoulder health, core power, footwork, arm strength", ageGroup: "15-18", price: 80 },
  { title: "Lacrosse Pre-Season Conditioning — 4 Weeks", sport: "lacrosse", level: "intermediate", goal: "endurance, stick-side power, agility", ageGroup: "13-17", price: 80 },
  { title: "Powerlifting Foundation — 6 Weeks", sport: "general", level: "beginner", goal: "squat, bench, deadlift form and base strength", ageGroup: "16+", price: 120 },
];

async function generateProgramSeoPage(
  title: string,
  sport: string,
  ageGroup: string,
  goal: string,
  slug: string,
  lovableKey: string
): Promise<{ pageTitle: string; metaDescription: string; content: string }> {
  const res = await fetch("https://api.lovable.ai/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: "You are a sports performance expert and SEO content writer. Write authoritative, helpful training content that ranks on Google.",
        },
        {
          role: "user",
          content: `Write an SEO landing page for this training program:

Title: "${title}"
Sport: ${sport}
Age group: ${ageGroup}
Training goals: ${goal}
Sold by: M² Training (Coach Matt Michels, Grosse Pointe MI)
Price: Available in the M² Training store

Output EXACTLY this format:
TITLE: [60-char page title]
META: [155-char meta description]
---
[400-500 words of HTML landing page content with:
- Opening paragraph explaining who this is for
- H2: What You'll Build (3-4 bullet points)
- H2: Program Details (duration, frequency, structure)
- H2: Why This Program Works (2-3 sentences about the coaching philosophy)
- Strong closing CTA to purchase]

No markdown. Pure HTML only in the content section.`,
        },
      ],
      temperature: 0.65,
      max_tokens: 800,
    }),
  });

  if (!res.ok) throw new Error(`AI SEO page error: ${res.status}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || "";

  const titleMatch = raw.match(/^TITLE: (.+)$/m);
  const metaMatch = raw.match(/^META: (.+)$/m);
  const contentStart = raw.indexOf("---\n");
  const content = contentStart >= 0 ? raw.slice(contentStart + 4).trim() : raw;

  return {
    pageTitle: titleMatch?.[1]?.trim() || title,
    metaDescription: metaMatch?.[1]?.trim() || `${title} — built by Coach Matt Michels for ${sport} athletes ages ${ageGroup}.`,
    content,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: isAdmin } = await serviceClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const generateCount: number = Math.min(body.count || 3, 5);

    // Find which programs in the catalog are already generated
    const { data: existingPrograms } = await serviceClient
      .from("training_programs")
      .select("title");

    const existingTitles = new Set((existingPrograms || []).map((p: any) => p.title.toLowerCase()));

    // Find next N programs not yet generated
    const toGenerate = PROGRAM_CATALOG.filter(p => !existingTitles.has(p.title.toLowerCase())).slice(0, generateCount);

    if (toGenerate.length === 0) {
      return new Response(JSON.stringify({ generated: [], message: "All catalog programs already exist" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("Programs to generate", { count: toGenerate.length, titles: toGenerate.map(p => p.title) });
    const generated: string[] = [];

    for (const program of toGenerate) {
      try {
        const slug = program.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

        // 1. Insert training program record
        const { data: newProgram, error: progErr } = await serviceClient
          .from("training_programs")
          .insert({
            title: program.title,
            category: program.goal.split(",")[0].trim(),
            level: program.level,
            sport: [program.sport],
            description: `Coach Matt Michels' ${program.title} — designed for ${program.sport} athletes (ages ${program.ageGroup}). Focus: ${program.goal}.`,
          })
          .select("id")
          .single();

        if (progErr) {
          log("Program insert error", { title: program.title, error: progErr.message });
          continue;
        }

        log("Program created", { title: program.title, id: newProgram.id });

        // 2. Generate SEO landing page
        const { pageTitle, metaDescription, content } = await generateProgramSeoPage(
          program.title, program.sport, program.ageGroup, program.goal, slug, LOVABLE_API_KEY
        );

        // Check slug doesn't already exist
        const { data: existingSlug } = await serviceClient
          .from("seo_landing_pages" as any)
          .select("id")
          .eq("slug", slug)
          .limit(1);

        if (!existingSlug || existingSlug.length === 0) {
          await serviceClient.from("seo_landing_pages" as any).insert({
            slug,
            page_title: pageTitle,
            meta_description: metaDescription,
            h1_heading: program.title,
            main_content: content,
            target_audience: `${program.sport} athletes ages ${program.ageGroup}`,
          });
          log("SEO page created", { slug });
        }

        generated.push(program.title);

        // Rate limit between AI calls
        await new Promise(r => setTimeout(r, 1500));
      } catch (err) {
        log("Error generating program", { title: program.title, error: String(err) });
      }
    }

    return new Response(
      JSON.stringify({
        generated,
        remaining: PROGRAM_CATALOG.length - (existingTitles.size + generated.length),
        message: `Generated ${generated.length} programs with SEO pages.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
