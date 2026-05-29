// multi-trend-scanner — daily 8am UTC
// Scrapes 6 rotating sources (from a list of 50) using Firecrawl + AI to extract
// POD niche ideas. Upserts into etsy_pod_trends with source tracking.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { firecrawlScrape } from "../_shared/firecrawl.ts";
import { generateJSON } from "../_shared/ai.ts";
import { checkAndConsume } from "../_shared/api-budget.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[MULTI-TREND] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

interface TrendSource {
  name: string;
  url: string;
  hint: string;
}

const SOURCES: TrendSource[] = [
  // POD marketplaces
  { name: "redbubble_trending", url: "https://www.redbubble.com/explore/trending", hint: "design keywords and trending themes on a print-on-demand marketplace" },
  { name: "teepublic_bestsellers", url: "https://www.teepublic.com/t-shirts", hint: "best-selling t-shirt phrases and designs" },
  { name: "zazzle_mugs", url: "https://www.zazzle.com/mugs?st=pop", hint: "popular mug phrases and gift ideas" },
  { name: "spreadshirt_trending", url: "https://www.spreadshirt.com/trending", hint: "trending shirt slogans and phrases" },
  { name: "society6_trending", url: "https://society6.com/explore", hint: "trending art and print styles" },
  { name: "threadless_popular", url: "https://www.threadless.com/collections/all", hint: "popular t-shirt design styles" },

  // Amazon gift categories
  { name: "amazon_dad_gifts", url: "https://www.amazon.com/s?k=funny+dad+gifts", hint: "best-selling funny dad gifts including mugs, shirts, novelty items" },
  { name: "amazon_mom_gifts", url: "https://www.amazon.com/s?k=funny+mom+gifts", hint: "best-selling funny mom gifts" },
  { name: "amazon_nurse_gifts", url: "https://www.amazon.com/s?k=nurse+gifts+funny", hint: "best-selling nurse gifts and novelty items" },
  { name: "amazon_teacher_gifts", url: "https://www.amazon.com/s?k=funny+teacher+gifts", hint: "best-selling funny teacher gifts" },
  { name: "amazon_graduation_gifts", url: "https://www.amazon.com/s?k=graduation+gifts+2026+funny", hint: "trending graduation gift ideas" },
  { name: "amazon_dog_owner_gifts", url: "https://www.amazon.com/s?k=dog+owner+gifts+funny", hint: "popular gifts for dog owners including mugs and shirts" },

  // Reddit trending humor
  { name: "reddit_funny_top", url: "https://www.reddit.com/r/funny/top/?t=month.json", hint: "top funny posts that could inspire humorous mug/shirt phrases" },
  { name: "reddit_wholesomememes", url: "https://www.reddit.com/r/wholesomememes/top/?t=month.json", hint: "wholesome sayings and feel-good phrases" },
  { name: "reddit_parenting", url: "https://www.reddit.com/r/Parenting/top/?t=month.json", hint: "parent humor and relatable parenting phrases" },
  { name: "reddit_teachers", url: "https://www.reddit.com/r/Teachers/top/?t=month.json", hint: "teacher humor and relatable teacher phrases" },
  { name: "reddit_nursing", url: "https://www.reddit.com/r/nursing/top/?t=month.json", hint: "nurse humor and relatable nursing phrases" },
  { name: "reddit_dogs", url: "https://www.reddit.com/r/dogs/top/?t=month.json", hint: "dog owner culture and funny dog phrases" },
  { name: "reddit_cats", url: "https://www.reddit.com/r/cats/top/?t=month.json", hint: "cat owner culture and funny cat phrases" },
  { name: "reddit_golf", url: "https://www.reddit.com/r/golf/top/?t=month.json", hint: "golf humor and golfer gift ideas" },

  // Quote sites (great for mug text)
  { name: "brainyquote_funny", url: "https://www.brainyquote.com/topics/funny-quotes", hint: "funny quotable phrases that work well on mugs or shirts" },
  { name: "quotegarden_funny", url: "https://www.quotegarden.com/funny.html", hint: "funny quotes good for print designs" },
  { name: "goodreads_funny_quotes", url: "https://www.goodreads.com/quotes/tag/funny", hint: "popular funny quotes from books" },

  // Viral / meme culture
  { name: "knowyourmeme_trending", url: "https://knowyourmeme.com/memes/trending", hint: "currently viral meme phrases that could work as gift designs" },

  // Gift-focused retail
  { name: "uncommon_goods_bestsellers", url: "https://www.uncommongoods.com/home/bestsellers", hint: "unique bestselling gift items and the occasions they target" },
  { name: "personalization_mall_bestsellers", url: "https://www.personalizationmall.com/bestsellers", hint: "best-selling personalized gift niches and occasions" },
  { name: "buzzfeed_gifts", url: "https://www.buzzfeed.com/gift-ideas", hint: "trending gift ideas by recipient type (nurse, teacher, dad, etc.)" },

  // POD industry insights
  { name: "printful_blog_trending", url: "https://www.printful.com/blog/trending-products", hint: "trending print-on-demand product types and niches" },
  { name: "merch_informer_blog", url: "https://merchinformer.com/blog", hint: "POD niche research and bestselling design categories" },

  // Etsy direct category scrapes
  { name: "etsy_funny_mugs", url: "https://www.etsy.com/search?q=funny+mugs&order=most_relevant", hint: "top-selling funny mug titles and themes on Etsy" },
  { name: "etsy_dad_gifts", url: "https://www.etsy.com/search?q=dad+gifts+funny&order=most_relevant", hint: "best-selling funny dad gift titles and themes on Etsy" },
  { name: "etsy_nurse_gifts", url: "https://www.etsy.com/search?q=nurse+gifts+funny&order=most_relevant", hint: "best-selling nurse gift titles and themes on Etsy" },
  { name: "etsy_teacher_gifts", url: "https://www.etsy.com/search?q=funny+teacher+gifts&order=most_relevant", hint: "best-selling teacher gift titles and themes on Etsy" },
  { name: "etsy_gift_guides", url: "https://www.etsy.com/gift-guides", hint: "curated gift guide categories and featured gift types" },
  { name: "etsy_cat_lover", url: "https://www.etsy.com/search?q=cat+lover+gifts&order=most_relevant", hint: "best-selling cat lover gift titles and themes on Etsy" },
  { name: "etsy_dog_lover", url: "https://www.etsy.com/search?q=dog+lover+gifts&order=most_relevant", hint: "best-selling dog lover gift titles and themes on Etsy" },

  // Father's Day specific (seasonal — peak window)
  { name: "etsy_fathers_day_mugs", url: "https://www.etsy.com/search?q=fathers+day+mug+funny&order=most_relevant", hint: "top Father's Day mug themes and phrases on Etsy" },
  { name: "etsy_fathers_day_shirts", url: "https://www.etsy.com/search?q=fathers+day+shirt+funny&order=most_relevant", hint: "top Father's Day shirt themes and slogans on Etsy" },
  { name: "amazon_fathers_day_2026", url: "https://www.amazon.com/s?k=fathers+day+gifts+2026+funny", hint: "trending 2026 Father's Day gift ideas" },

  // Niche humor categories
  { name: "etsy_retirement_gifts", url: "https://www.etsy.com/search?q=retirement+gifts+funny&order=most_relevant", hint: "best-selling retirement gift phrases and themes" },
  { name: "etsy_plant_lady", url: "https://www.etsy.com/search?q=plant+lady+gifts&order=most_relevant", hint: "best-selling plant lover gift themes and phrases" },
  { name: "etsy_wine_lover", url: "https://www.etsy.com/search?q=wine+lover+gifts+funny&order=most_relevant", hint: "wine lover humor themes for mugs and shirts" },
  { name: "etsy_coffee_lover", url: "https://www.etsy.com/search?q=coffee+lover+gifts+funny&order=most_relevant", hint: "coffee lover humor themes for mugs" },
  { name: "etsy_engineer_gifts", url: "https://www.etsy.com/search?q=engineer+gifts+funny&order=most_relevant", hint: "engineer humor gift themes and phrases" },
  { name: "etsy_accountant_gifts", url: "https://www.etsy.com/search?q=accountant+gifts+funny&order=most_relevant", hint: "accountant/CPA humor gift themes" },
  { name: "etsy_lawyer_gifts", url: "https://www.etsy.com/search?q=lawyer+gifts+funny&order=most_relevant", hint: "lawyer/attorney humor gift themes" },
  { name: "etsy_firefighter_gifts", url: "https://www.etsy.com/search?q=firefighter+gifts+funny&order=most_relevant", hint: "firefighter humor gift themes" },
  { name: "etsy_police_gifts", url: "https://www.etsy.com/search?q=police+officer+gifts+funny&order=most_relevant", hint: "police officer humor gift themes" },

  // Seasonal/upcoming
  { name: "etsy_graduation_2026", url: "https://www.etsy.com/search?q=graduation+gifts+2026+funny&order=most_relevant", hint: "2026 graduation gift themes and funny phrases" },
  { name: "etsy_birthday_humor", url: "https://www.etsy.com/search?q=funny+birthday+gifts&order=most_relevant", hint: "funny birthday gift themes for various ages" },
  { name: "etsy_christmas_2026", url: "https://www.etsy.com/search?q=funny+christmas+gifts+2026&order=most_relevant", hint: "early holiday gift ideas and funny Christmas themes" },
];

interface ExtractedNiche {
  niche: string;
  keywords: string[];
  why_trending: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const batchMode = url.searchParams.get("batch") === "true";
  const sourcesPerRun = batchMode ? 12 : 6;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

  if (!FIRECRAWL_API_KEY) {
    return new Response(JSON.stringify({ error: "FIRECRAWL_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Budget gate — Firecrawl + LLM calls
  const { allowed } = await checkAndConsume(sb, "firecrawl", sourcesPerRun, "firecrawl_scrape");
  if (!allowed) {
    log("Firecrawl daily budget exhausted");
    return new Response(
      JSON.stringify({ error: "Daily Firecrawl budget exhausted" }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Pick sources for today, rotating through all 50
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const startIdx = (dayOfYear * sourcesPerRun) % SOURCES.length;
  const todaySources: TrendSource[] = [];
  for (let i = 0; i < sourcesPerRun; i++) {
    todaySources.push(SOURCES[(startIdx + i) % SOURCES.length]);
  }

  log("Scanning sources today", todaySources.map(s => s.name));

  const inserted: string[] = [];
  const errors: Array<{ source: string; error: string }> = [];

  for (const source of todaySources) {
    try {
      log("Scraping", { source: source.name, url: source.url });

      const scraped = await firecrawlScrape(source.url, { onlyMainContent: true, timeout: 20_000 });
      if (!scraped?.markdown) {
        log("No content scraped", { source: source.name });
        errors.push({ source: source.name, error: "Empty scrape result" });
        continue;
      }

      // Truncate to avoid massive prompts
      const content = scraped.markdown.slice(0, 3000);

      const prompt = `You are analyzing a webpage to find print-on-demand gift product ideas (mugs, t-shirts, tote bags).

Source: "${source.name}" — context: ${source.hint}

Webpage content:
${content}

Extract exactly 5 specific product niches that would make great gift items for print-on-demand. Focus on:
- Occupations/professions (nurse, teacher, engineer, firefighter)
- Hobbies (golf, gardening, reading, coffee)
- Relationships (dog mom, cat dad, plant lady)
- Humor themes (sarcastic sayings, relatable struggles)
- Seasonal/gift occasions (Father's Day, graduation, retirement)

Respond with a JSON array of exactly 5 objects: [{"niche":"...","keywords":["...","..."],"why_trending":"..."}]
Each niche should be 2-5 words, highly specific, giftable. No brand names.`;

      const niches = await generateJSON<ExtractedNiche[]>(prompt, [], 400);
      if (!niches || niches.length === 0) {
        log("AI extracted no niches", { source: source.name });
        errors.push({ source: source.name, error: "AI returned empty niches" });
        continue;
      }

      log("Niches extracted", { source: source.name, count: niches.length });

      for (const n of niches) {
        if (!n.niche || n.niche.length < 3) continue;

        const slugId = `multi-${source.name}-${n.niche.toLowerCase().replace(/\s+/g, "-").slice(0, 40)}`;
        const row = {
          niche: n.niche.slice(0, 100),
          listing_id: slugId,
          title: `${n.niche} — trending via ${source.name.replace(/_/g, " ")}`,
          tags: (n.keywords ?? []).slice(0, 13),
          source: source.name,
          processed: false,
          num_favorers: 0,
        };

        const { error: insertErr } = await sb.from("etsy_pod_trends").insert(row);
        if (insertErr) {
          if (insertErr.code !== "23505") {
            log("Insert error", { niche: n.niche, error: insertErr.message });
          }
        } else {
          inserted.push(n.niche.slice(0, 50));
        }
      }

      // Polite delay between sources
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      const msg = String(err);
      log("Error processing source", { source: source.name, error: msg });
      errors.push({ source: source.name, error: msg });
    }
  }

  log("Done", { inserted: inserted.length, errors: errors.length });
  return new Response(
    JSON.stringify({ sources_scanned: todaySources.length, inserted: inserted.length, niches: inserted, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
