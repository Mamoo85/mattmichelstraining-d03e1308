import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { service, keywords, url, audience, price, tagline, budget = 200 } = await req.json();

    const dailyBudget = (budget / 30).toFixed(2);

    const prompt = `You are a Google Ads and Facebook Ads expert. Generate a complete, ready-to-launch ad campaign for this service:

SERVICE: ${service}
PRICE: ${price}
TAGLINE: ${tagline}
TARGET AUDIENCE: ${audience}
LANDING PAGE: ${url}
MONTHLY BUDGET: $${budget} ($${dailyBudget}/day)
TARGET KEYWORDS: ${keywords}

Generate in this EXACT format — copy-paste ready for Ads Manager:

════════════════════════════════════════
GOOGLE ADS CAMPAIGN
════════════════════════════════════════

CAMPAIGN NAME: M² - ${service} - Search
CAMPAIGN TYPE: Search
DAILY BUDGET: $${dailyBudget}
BID STRATEGY: Maximize Conversions (Target CPA once 30 conversions hit)
LOCATION: United States
LANGUAGE: English

────────────────────────────────────────
AD GROUP 1: Core Intent
────────────────────────────────────────
[Exact Match Keywords — copy into Keywords tab]
[keyword 1]
[keyword 2]
[keyword 3]
[keyword 4]
[keyword 5]

"Phrase Match Keywords"
"phrase keyword 1"
"phrase keyword 2"
"phrase keyword 3"

Negative Keywords (add to campaign):
-[negative 1]
-[negative 2]
-[negative 3]
-[negative 4]
-[negative 5]
-[negative 6]
-[negative 7]
-[negative 8]
-[negative 9]
-[negative 10]

────────────────────────────────────────
RESPONSIVE SEARCH AD #1 (Primary)
────────────────────────────────────────
Headline 1 (30 chars max):
Headline 2 (30 chars max):
Headline 3 (30 chars max):
Headline 4 (30 chars max):
Headline 5 (30 chars max):
Description 1 (90 chars max):
Description 2 (90 chars max):
Final URL: ${url}

────────────────────────────────────────
RESPONSIVE SEARCH AD #2 (Price/Urgency)
────────────────────────────────────────
Headline 1 (30 chars max):
Headline 2 (30 chars max):
Headline 3 (30 chars max):
Headline 4 (30 chars max):
Description 1 (90 chars max):
Description 2 (90 chars max):
Final URL: ${url}

AD EXTENSIONS:
Sitelink 1: [text] → [url path]
Sitelink 2: [text] → [url path]
Callout 1: [text]
Callout 2: [text]
Callout 3: [text]
Call Extension: (313) 806-4952

════════════════════════════════════════
FACEBOOK / INSTAGRAM ADS CAMPAIGN
════════════════════════════════════════

CAMPAIGN OBJECTIVE: Lead Generation
DAILY BUDGET: $${(budget * 0.4 / 30).toFixed(2)} (start — scale once profitable)

────────────────────────────────────────
AD SET 1: Cold — Core Audience
────────────────────────────────────────
Age Range:
Locations: United States
Interests (select in Ads Manager):
  •
  •
  •
  •
  •
Behaviors:
  •
  •
Exclude:

PRIMARY TEXT (125 chars max):
HEADLINE (40 chars max):
DESCRIPTION (30 chars max):
CTA BUTTON: Learn More
FORMAT: Single Image or Video

────────────────────────────────────────
AD SET 2: Warm — Lookalike 1% (once you have 100+ leads)
────────────────────────────────────────
Source: Website visitors / lead list
Lookalike: 1% United States
PRIMARY TEXT:
HEADLINE:
CTA: Get Started

────────────────────────────────────────
CREATIVE BRIEF (for image/video)
────────────────────────────────────────
Hook (first 3 seconds if video):
Visual concept:
Text overlay:
Color palette: Orange (#e8621a) on dark slate (#1e293b)

════════════════════════════════════════
CAMPAIGN STRATEGY & PROJECTIONS
════════════════════════════════════════

LAUNCH SEQUENCE:
Week 1-2: Run both Google ad groups, both Facebook ad sets simultaneously
Week 3: Pause lowest performer, double budget on winner
Week 4+: Scale winner, introduce retargeting

EXPECTED METRICS (conservative):
Google CTR: 3-8%
Google CPC: $[estimate]
Google CPL: $[estimate]
Facebook CPM: $[estimate]
Facebook CPL: $[estimate]
Trial conversion rate: 30-50%
Trial-to-paid rate: 40-60%

AT $${budget}/mo BUDGET:
Estimated leads/month:
Estimated trials/month:
Estimated new paying customers/month:
Expected new MRR from this budget:
Break-even timeline:

FIRST A/B TEST: [what to test first — headline vs headline, or image vs image]`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      throw new Error(`AI API error: ${res.status}`);
    }

    const data = await res.json();
    const campaign = data?.choices?.[0]?.message?.content || "Campaign generation failed — try again.";

    return new Response(JSON.stringify({ campaign }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
