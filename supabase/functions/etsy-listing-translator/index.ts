// etsy-listing-translator — translates top 20 Etsy listings into German, French, Spanish.
// Uses GPT-4o-mini for translation, Etsy PUT translations API to push.
// Skips listings already translated in last 30 days (idempotent).
//
// Run: POST {} — translate top 20 by num_favorers
// Run: POST {"dry_run": true} — returns translations without pushing to Etsy
// Run: POST {"limit": 5} — translate only N listings
// Cron: weekly Sunday 3am UTC on secondary project

import { createClient } from "npm:@supabase/supabase-js@2";

const ETSY_API_KEY = Deno.env.get("ETSY_API_KEY") ?? "";
const ETSY_SHOP_ID = Deno.env.get("ETSY_SHOP_ID") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: unknown) =>
  console.log(`[ETSY-TRANSLATOR] ${s}${d ? " — " + JSON.stringify(d) : ""}`);

const TARGET_LANGUAGES = [
  { code: "de", name: "German" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
];

interface TranslationResult {
  title: string;
  description: string;
  tags: string[];
}

async function translateListing(
  title: string,
  description: string,
  tags: string[],
  language: string,
  languageName: string,
): Promise<TranslationResult | null> {
  if (!OPENAI_API_KEY) return null;

  try {
    const prompt =
      `You are an Etsy SEO expert translating an English product listing to ${languageName}.

Title (English): "${title}"
Description (English): "${description.slice(0, 500)}"
Tags (English, 13 tags): ${tags.join(", ")}

Translate ALL content to ${languageName}. Keep the same tone (friendly, gift-focused).
For tags: translate each tag to the ${languageName} equivalent search term buyers would use. Keep each tag ≤20 chars.

Return ONLY a JSON object with:
- "title": translated title (≤140 chars)
- "description": translated description (300-500 chars, mention free US shipping in ${languageName})
- "tags": array of exactly 13 ${languageName} tags (lowercase, ≤20 chars each)

Return ONLY valid JSON, no markdown.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 700,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) {
      log("GPT call failed", { status: res.status });
      return null;
    }

    const data = await res.json() as any;
    const text = (data.choices?.[0]?.message?.content ?? "").replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(text) as TranslationResult;

    // Validate
    if (!parsed.title || !Array.isArray(parsed.tags) || parsed.tags.length !== 13) {
      log("Invalid GPT response shape", { parsed });
      return null;
    }

    return {
      title: parsed.title.slice(0, 140),
      description: (parsed.description || "").slice(0, 2000),
      tags: parsed.tags.slice(0, 13).map((t: string) => t.slice(0, 20).toLowerCase()),
    };
  } catch (e) {
    log("Translation error", { err: String(e).slice(0, 100) });
    return null;
  }
}

async function pushTranslation(
  listingId: string,
  langCode: string,
  translation: TranslationResult,
): Promise<boolean> {
  const res = await fetch(
    `https://openapi.etsy.com/v3/application/listings/${listingId}/translations/${langCode}`,
    {
      method: "PUT",
      headers: {
        "x-api-key": ETSY_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: translation.title,
        description: translation.description,
        tags: translation.tags,
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    log("Push translation failed", { listingId, langCode, status: res.status, err: errText.slice(0, 100) });
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!ETSY_API_KEY || !ETSY_SHOP_ID) {
    return Response.json({ error: "ETSY_API_KEY and ETSY_SHOP_ID required" }, { status: 500, headers: CORS });
  }
  if (!OPENAI_API_KEY) {
    return Response.json({ error: "OPENAI_API_KEY required" }, { status: 500, headers: CORS });
  }

  const body = await req.json().catch(() => ({})) as { dry_run?: boolean; limit?: number };
  const dryRun = body.dry_run === true;
  const listingLimit = typeof body.limit === "number" ? body.limit : 20;
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    log("Starting translation run", { dryRun, listingLimit });

    // Fetch top listings by favorers
    const { data: listings, error: fetchErr } = await sb
      .from("etsy_listings")
      .select("listing_id, title, description, tags")
      .eq("status", "active")
      .not("title", "eq", "")
      .order("num_favorers", { ascending: false })
      .limit(listingLimit);

    if (fetchErr || !listings) {
      return Response.json({ error: fetchErr?.message ?? "No listings found" }, { status: 500, headers: CORS });
    }

    log("Fetched top listings", { count: listings.length });

    const results: Array<{
      listing_id: string;
      title: string;
      languages: Record<string, { status: string; dry_run_preview?: TranslationResult }>;
    }> = [];

    let translated = 0;
    let skipped = 0;
    let errors = 0;

    for (const listing of listings) {
      const listingResult: (typeof results)[0] = {
        listing_id: listing.listing_id,
        title: listing.title.slice(0, 60),
        languages: {},
      };

      for (const lang of TARGET_LANGUAGES) {
        // Check if already translated in last 30 days
        const { data: existing } = await sb
          .from("etsy_listing_translations")
          .select("translated_at")
          .eq("listing_id", listing.listing_id)
          .eq("language", lang.code)
          .gte("translated_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .maybeSingle();

        if (existing) {
          listingResult.languages[lang.code] = { status: "skipped_recent" };
          skipped++;
          continue;
        }

        // Generate translation
        const translation = await translateListing(
          listing.title,
          listing.description || "",
          Array.isArray(listing.tags) ? listing.tags : [],
          lang.code,
          lang.name,
        );

        if (!translation) {
          listingResult.languages[lang.code] = { status: "error_translation_failed" };
          errors++;
          continue;
        }

        if (dryRun) {
          listingResult.languages[lang.code] = {
            status: "dry_run",
            dry_run_preview: translation,
          };
          continue;
        }

        // Push to Etsy
        const pushed = await pushTranslation(listing.listing_id, lang.code, translation);
        if (pushed) {
          // Record in tracking table
          await sb.from("etsy_listing_translations").upsert({
            listing_id: listing.listing_id,
            language: lang.code,
            translated_at: new Date().toISOString(),
          }, { onConflict: "listing_id,language" }).catch(() => {});

          listingResult.languages[lang.code] = { status: "ok" };
          translated++;
        } else {
          listingResult.languages[lang.code] = { status: "error_push_failed" };
          errors++;
        }

        await new Promise((r) => setTimeout(r, 300));
      }

      results.push(listingResult);
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!dryRun) {
      await sb.from("agent_heartbeats").upsert({
        agent_name: "etsy-listing-translator",
        last_run_at: new Date().toISOString(),
        last_status: errors === 0 ? "ok" : "partial",
        last_result: JSON.stringify({ translated, skipped, errors, listings: listings.length }),
      }, { onConflict: "agent_name" }).catch(() => {});
    }

    log("Translation run complete", { translated, skipped, errors });
    return Response.json({
      status: dryRun ? "dry_run" : "ok",
      listings_processed: listings.length,
      translations_pushed: translated,
      skipped_recent: skipped,
      errors,
      results,
    }, { headers: CORS });

  } catch (err) {
    log("Fatal", { err: String(err) });
    return Response.json({ error: String(err) }, { status: 500, headers: CORS });
  }
});
