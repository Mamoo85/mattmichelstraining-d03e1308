// AdLauncher.tsx — Meta Ads campaign launcher for top-ROI products
// Route: /dwa-admin/ads
// Calls ad-creative-studio (secondary project) to generate creatives,
// then meta-ads-poster to create a PAUSED campaign in Meta Ads Manager.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Play, Loader2, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Secondary (POD) project — hosts Meta ad functions + META_USER_ACCESS_TOKEN
const POD_URL = "https://zmyczlfuufhngzovkjdh.supabase.co/functions/v1";
const ADS_MANAGER_URL = "https://www.facebook.com/adsmanager/manage/ads?act=1969872620513768";
const EXISTING_CAMPAIGN_URL = `${ADS_MANAGER_URL}&selected_campaign_ids=120243880723670377`;

interface Product {
  id: string;
  brand: string; // matches brand config key in meta-ads-poster
  name: string;
  price: string;
  dailyBudget: string;
  ltv: string;
  platform: string;
  niche: string;
  concept: string;
  headline: string;
  bodyText: string;
  ctaUrl: string;
  tier: "top" | "mid";
  note?: string;
}

const PRODUCTS: Product[] = [
  {
    id: "dwa-restaurant",
    brand: "dwa-restaurant",
    name: "DWA Restaurant Website",
    price: "$799 + $79/mo",
    dailyBudget: "$20/day",
    ltv: "~$1,750",
    platform: "Meta (Facebook + Instagram)",
    niche: "restaurant owners metro detroit",
    concept: "before after website redesign",
    headline: "Your restaurant deserves a better website",
    bodyText: "Detroit Web Agency builds stunning restaurant websites in 7 days. $799 setup + $79/mo. Free mockup.",
    ctaUrl: "https://detroitwebagent.com/start-here?utm_source=meta&utm_medium=paid&utm_campaign=restaurant_website",
    tier: "top",
  },
  {
    id: "dwa-website",
    brand: "dwa-website",
    name: "DWA Website (Healthcare/Dental/Legal)",
    price: "$1,499 + $99/mo",
    dailyBudget: "$15/day",
    ltv: "~$2,700",
    platform: "Meta (Facebook + Instagram)",
    niche: "dental practice website michigan",
    concept: "professional dental website conversion",
    headline: "More patients start with a better website",
    bodyText: "Detroit Web Agency builds high-converting dental & healthcare websites. $1,499 setup + $99/mo. Free mockup.",
    ctaUrl: "https://detroitwebagent.com/start-here?utm_source=meta&utm_medium=paid&utm_campaign=website_packages",
    tier: "top",
  },
  {
    id: "dwa-missed-call",
    brand: "dwa-missed-call",
    name: "Missed-Call Catch",
    price: "$99/mo",
    dailyBudget: "$15/day",
    ltv: "~$594",
    platform: "Meta (Facebook + Instagram)",
    niche: "local business missed calls",
    concept: "missed call auto text response",
    headline: "Stop losing customers to missed calls",
    bodyText: "Every missed call is a missed sale. Missed-Call Catch texts them back instantly so they book — not your competitor. $99/mo.",
    ctaUrl: "https://detroitwebagent.com/start-here?product=missed_call&utm_source=meta&utm_medium=paid&utm_campaign=missed_call",
    tier: "top",
  },
  {
    id: "m2-elite",
    brand: "m2-elite",
    name: "M2 Elite Training",
    price: "$349.99/mo",
    dailyBudget: "$20/day",
    ltv: "~$2,100",
    platform: "Instagram Reels + Meta",
    niche: "weight loss coaching detroit",
    concept: "transformation before after",
    headline: "Lose 20+ lbs with 1-on-1 coaching",
    bodyText: "1-on-1 personal training from Matt Michels. Lose 20+ lbs, build real strength. $349/mo, free 7-day trial.",
    ctaUrl: "https://www.mattmichelstraining.com/start-trial?product=elite&utm_source=meta&utm_medium=paid&utm_campaign=m2_elite",
    tier: "top",
    note: "Record a 30–60s transformation video first for best results on Reels.",
  },
];

type JobState = "idle" | "generating" | "launching" | "done" | "error";

interface ProductState {
  jobState: JobState;
  jobId?: string;
  campaignId?: string;
  error?: string;
  imageUrl?: string;
}

export default function AdLauncher() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [states, setStates] = useState<Record<string, ProductState>>({});

  const setState = (id: string, patch: Partial<ProductState>) =>
    setStates(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const handleLaunch = async (product: Product) => {
    setState(product.id, { jobState: "generating", error: undefined });
    try {
      // Step 1: Generate creative via ad-creative-studio
      const creativeRes = await fetch(`${POD_URL}/ad-creative-studio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: product.brand,
          niche: product.niche,
          concept: product.concept,
          headline: product.headline,
          subhead: product.bodyText,
          ctaText: "Get Started",
          ctaUrl: product.ctaUrl,
          formats: ["meta_feed", "meta_link"],
        }),
      });
      const creativeData = await creativeRes.json();
      if (!creativeRes.ok) throw new Error(creativeData.error || "Creative generation failed");

      const jobId = creativeData.job_id;
      const imageUrl = creativeData.format_urls?.meta_link ?? creativeData.format_urls?.meta_feed;
      setState(product.id, { jobState: "launching", jobId, imageUrl });

      // Step 2: Launch campaign via meta-ads-poster
      const launchRes = await fetch(`${POD_URL}/meta-ads-poster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: product.brand,
          jobId,
          dailyBudgetCents: parseInt(product.dailyBudget.replace(/\D/g, "")) * 100,
        }),
      });
      const launchData = await launchRes.json();
      if (!launchRes.ok) throw new Error(launchData.error || "Campaign launch failed");

      setState(product.id, {
        jobState: "done",
        campaignId: launchData.campaign_id,
      });
      toast({
        title: "Campaign created (PAUSED)",
        description: `${product.name} campaign is ready in Meta Ads Manager. Activate it to go live.`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState(product.id, { jobState: "error", error: msg });
      toast({ title: "Launch failed", description: msg, variant: "destructive" });
    }
  };

  const s = (id: string): ProductState => states[id] ?? { jobState: "idle" };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dwa-admin")} className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Meta Ad Launcher</h1>
            <p className="text-gray-400 text-sm">Generate creatives + create PAUSED campaigns. Activate in Ads Manager when ready.</p>
          </div>
        </div>

        {/* Existing campaign widget */}
        <Card className="bg-gray-900 border-gray-700 mb-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" />
              Existing DWA Campaign — Action Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
              <div>
                <p className="font-medium text-sm">DWA General — campaign <code className="text-xs text-gray-400">120243880723670377</code></p>
                <p className="text-xs text-gray-400 mt-0.5">Status: <span className="text-yellow-400 font-medium">PAUSED</span> · Budget: $5/day · Needs $20/day</p>
              </div>
              <a
                href={EXISTING_CAMPAIGN_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 gap-1">
                  Open in Ads Manager <ExternalLink className="w-3 h-3" />
                </Button>
              </a>
            </div>
            <p className="text-xs text-gray-500">
              1. Click "Open in Ads Manager" → change budget from $5 to $20/day → click Activate to go live.
              This is the fastest path to your first impressions — zero new code needed.
            </p>
          </CardContent>
        </Card>

        {/* Product cards */}
        <h2 className="text-lg font-semibold mb-4">Top-ROI Campaigns to Launch</h2>
        <div className="grid gap-4">
          {PRODUCTS.map(product => {
            const ps = s(product.id);
            const isWorking = ps.jobState === "generating" || ps.jobState === "launching";

            return (
              <Card key={product.id} className="bg-gray-900 border-gray-700">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{product.name}</h3>
                        <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">{product.price}</Badge>
                        <Badge variant="outline" className="text-xs border-green-700 text-green-400">LTV {product.ltv}</Badge>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">{product.platform} · {product.dailyBudget}</p>
                      <p className="text-xs text-gray-500 mt-1 italic">"{product.headline}"</p>
                      {product.note && (
                        <p className="text-xs text-amber-400 mt-1.5 flex items-start gap-1">
                          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                          {product.note}
                        </p>
                      )}

                      {/* Status row */}
                      {ps.jobState === "generating" && (
                        <p className="text-xs text-blue-400 mt-2 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Generating ad creative…
                        </p>
                      )}
                      {ps.jobState === "launching" && (
                        <p className="text-xs text-blue-400 mt-2 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Creating campaign in Meta…
                        </p>
                      )}
                      {ps.jobState === "done" && (
                        <div className="mt-2 flex items-center gap-3">
                          <p className="text-xs text-green-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Campaign created (PAUSED) — activate in Ads Manager
                          </p>
                          {ps.campaignId && (
                            <a
                              href={`${ADS_MANAGER_URL}&selected_campaign_ids=${ps.campaignId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 underline flex items-center gap-0.5"
                            >
                              Open <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      )}
                      {ps.jobState === "error" && (
                        <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {ps.error}
                        </p>
                      )}
                    </div>

                    {/* Action button */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Button
                        onClick={() => handleLaunch(product)}
                        disabled={isWorking || ps.jobState === "done"}
                        className="bg-green-700 hover:bg-green-600 gap-1 min-w-[140px]"
                        size="sm"
                      >
                        {isWorking ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> Working…</>
                        ) : ps.jobState === "done" ? (
                          <><CheckCircle2 className="w-3 h-3" /> Done</>
                        ) : (
                          <><Play className="w-3 h-3" /> Generate + Launch</>
                        )}
                      </Button>
                      {ps.imageUrl && (
                        <a href={ps.imageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 underline">
                          View creative
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Manual action checklist */}
        <Card className="bg-gray-900 border-gray-700 mt-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Before Campaigns Go Live — Your Checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-gray-500 mt-0.5">□</span>
                Activate existing DWA campaign (link above) · change budget to $20/day
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500 mt-0.5">□</span>
                Connect @dwaagent1 Instagram to DWA Facebook page in{" "}
                <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">
                  Meta Business Manager
                </a>{" "}
                → enables Instagram placement on DWA campaigns
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500 mt-0.5">□</span>
                Record M2 Elite transformation video (30–60 sec, Matt on camera) · upload to Instagram Reels first, then boost via Ads Manager
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500 mt-0.5">□</span>
                Upload customer email list to{" "}
                <a href="https://www.facebook.com/adsmanager/audiences" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">
                  Meta Audiences
                </a>{" "}
                (100+ emails) to build 1% lookalike audience
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500 mt-0.5">□</span>
                Verify Meta Pixel is firing on detroitwebagent.com and mattmichelstraining.com (required for retargeting)
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* ROI summary */}
        <div className="mt-6 p-4 bg-gray-900 rounded-lg border border-gray-700">
          <h3 className="font-semibold text-sm mb-2">Projected Month-1 Returns at $80/day total spend</h3>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
            <span>DWA Restaurant ($20/day)</span><span className="text-green-400">2 closes → $1,598+ setup</span>
            <span>DWA Healthcare ($15/day)</span><span className="text-green-400">1 close → $1,499 setup</span>
            <span>Missed-Call Catch ($15/day)</span><span className="text-green-400">3 converts → $297 MRR</span>
            <span>M2 Elite ($20/day)</span><span className="text-green-400">2 sign-ups → $700 MRR</span>
            <span className="font-semibold text-white col-span-1">$2,400 spend</span>
            <span className="font-semibold text-green-400">~$4,800+ estimated return</span>
          </div>
        </div>
      </div>
    </div>
  );
}
