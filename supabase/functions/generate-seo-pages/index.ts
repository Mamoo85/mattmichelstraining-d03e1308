import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function slugify(keyword: string, location?: string): string {
  const raw = location ? `${keyword}-${location}` : keyword;
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check — admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.claims.sub as string;

    // Check admin role
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleRow } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { pages } = await req.json() as {
      pages: Array<{ keyword: string; location?: string; target_audience: string }>;
    };

    if (!pages?.length) {
      return new Response(JSON.stringify({ error: "No pages provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ slug: string; status: string }> = [];

    for (const item of pages) {
      const slug = slugify(item.keyword, item.location);

      // Check if slug already exists
      const { data: existing } = await serviceClient
        .from("seo_landing_pages")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (existing) {
        results.push({ slug, status: "skipped_duplicate" });
        continue;
      }

      const locationText = item.location || "your area";
      const systemPrompt = `You are an elite strength coach with 20 years of experience. Write a highly authoritative, 600-word landing page about "${item.keyword}" for ${item.target_audience} in ${locationText}. Use strict HTML formatting. Do not sound like a marketer. Focus on biomechanics, joint health, and raw strength fundamentals (incorporating principles of linear progression and tissue mobility). Include an H2 section on why generic routines fail for this specific demographic.`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Write the landing page now. Return ONLY the HTML body content (no <html>, <head>, or <body> tags). Also return a compelling page title and meta description as the first two lines in this exact format:\nTITLE: ...\nMETA: ...\n\nThen the HTML content below.`,
            },
          ],
        }),
      });

      if (!aiRes.ok) {
        const errText = await aiRes.text();
        console.error(`AI error for ${slug}:`, aiRes.status, errText);
        results.push({ slug, status: `ai_error_${aiRes.status}` });
        continue;
      }

      const aiData = await aiRes.json();
      const raw = aiData.choices?.[0]?.message?.content || "";

      // Parse TITLE and META from the response
      let pageTitle = `${item.keyword} Training`;
      let metaDescription = `Expert ${item.keyword} training for ${item.target_audience}.`;
      let mainContent = raw;

      const titleMatch = raw.match(/^TITLE:\s*(.+)$/m);
      const metaMatch = raw.match(/^META:\s*(.+)$/m);

      if (titleMatch) {
        pageTitle = titleMatch[1].trim();
        mainContent = mainContent.replace(titleMatch[0], "");
      }
      if (metaMatch) {
        metaDescription = metaMatch[1].trim();
        mainContent = mainContent.replace(metaMatch[0], "");
      }

      mainContent = mainContent.trim();

      // Derive h1 from keyword + location
      const h1Parts = [item.keyword];
      if (item.location) h1Parts.push(`in ${item.location}`);
      const h1Heading = h1Parts
        .map((w) => w.replace(/\b\w/g, (c) => c.toUpperCase()))
        .join(" ");

      const { error: insertErr } = await serviceClient
        .from("seo_landing_pages")
        .insert({
          slug,
          page_title: pageTitle,
          meta_description: metaDescription,
          h1_heading: h1Heading,
          main_content: mainContent,
          target_audience: item.target_audience,
        });

      if (insertErr) {
        console.error(`Insert error for ${slug}:`, insertErr);
        results.push({ slug, status: "insert_error" });
      } else {
        results.push({ slug, status: "created" });
      }

      // Small delay between AI calls to avoid rate limits
      if (pages.indexOf(item) < pages.length - 1) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-seo-pages error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
