// MarketingHub.tsx — Per-product marketing generator + manual posting guides
// Generate Reddit/Facebook/LinkedIn/email copy for each DWA product with one click.
// Route: /dwa-admin/marketing-hub

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  ArrowLeft, Copy, RefreshCw, CheckCheck, ExternalLink,
  MessageSquare, Users, Mail, Share2, Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Product marketing configs ────────────────────────────────────────────────
interface ProductMarketing {
  id: string;
  name: string;
  price: string;
  niche: string;
  tagline: string;
  reddit: {
    subs: Array<{ name: string; url: string; tip: string }>;
    postDays: string;
  };
  facebook: {
    groups: Array<{ name: string; members: string; tip: string }>;
  };
  linkedin: {
    searchTerms: string[];
    approach: string;
  };
  coldEmail: {
    subject: string;
    targetTitle: string;
  };
}

const PRODUCTS: ProductMarketing[] = [
  {
    id: "captions",
    name: "AI Social Captions",
    price: "$29/mo",
    niche: "Small businesses needing social content",
    tagline: "30 industry-specific social posts in 60 seconds",
    reddit: {
      subs: [
        { name: "r/smallbusiness", url: "reddit.com/r/smallbusiness", tip: "Post Tue/Thu, reply with demo when asked" },
        { name: "r/entrepreneur", url: "reddit.com/r/entrepreneur", tip: "Check weekly 'Tools' threads" },
        { name: "r/socialmedia", url: "reddit.com/r/socialmedia", tip: "Lead with time-saved stats" },
        { name: "r/digital_marketing", url: "reddit.com/r/digital_marketing", tip: "Industry-specific angle works best" },
      ],
      postDays: "Tuesday and Thursday",
    },
    facebook: {
      groups: [
        { name: "Small Business Owners", members: "156K", tip: "Post example captions with 'DM me for trial'" },
        { name: "Online Business Owners", members: "98K", tip: "Before/after content calendar screenshot" },
        { name: "Entrepreneurs & Business Owners", members: "210K", tip: "Lead with the $29/mo price point" },
      ],
    },
    linkedin: {
      searchTerms: ["small business owner", "marketing manager", "salon owner", "contractor"],
      approach: "Show before/after: generic post vs industry-specific post for their exact vertical",
    },
    coldEmail: {
      subject: "30 social posts in 60 seconds — tailored to [industry]",
      targetTitle: "Business Owner / Marketing Manager",
    },
  },
  {
    id: "church",
    name: "AI Church Newsletter",
    price: "$29/mo",
    niche: "Church administrators and pastors",
    tagline: "Full church newsletter in 60 seconds — AI-written, human-reviewed",
    reddit: {
      subs: [
        { name: "r/Christianity", url: "reddit.com/r/Christianity", tip: "Approach as helpful, never promotional" },
        { name: "r/pastors", url: "reddit.com/r/pastors", tip: "Post in 'tools' or 'admin' discussions" },
        { name: "r/churchsound", url: "reddit.com/r/churchsound", tip: "Cross-post if relevant to church admin" },
        { name: "r/Reformed", url: "reddit.com/r/Reformed", tip: "Post in weekly admin threads" },
      ],
      postDays: "Tuesday (most active for church staff)",
    },
    facebook: {
      groups: [
        { name: "Church Administrator Network", members: "47K", tip: "Best ROI — highly targeted, low competition" },
        { name: "Church Communications Professionals", members: "22K", tip: "Post example newsletter with their church style" },
        { name: "Ministry Leaders", members: "38K", tip: "Focus on time saved (4hrs/week)" },
        { name: "Women in Ministry", members: "29K", tip: "Admin-heavy audience, great fit" },
      ],
    },
    linkedin: {
      searchTerms: ["church administrator", "executive pastor", "director of communications church", "ministry director"],
      approach: "Personalize with their church name — 'I generated a sample newsletter for [Church Name]'",
    },
    coldEmail: {
      subject: "Your church newsletter in 60 seconds — free sample inside",
      targetTitle: "Church Administrator / Executive Pastor",
    },
  },
  {
    id: "ag-alerts",
    name: "Ag Price Alerts",
    price: "$79/mo",
    niche: "Grain farmers and agricultural operations",
    tagline: "Real-time SMS when corn/soybeans/wheat hit YOUR target price",
    reddit: {
      subs: [
        { name: "r/farming", url: "reddit.com/r/farming", tip: "Lead with a specific commodity price example" },
        { name: "r/agriculture", url: "reddit.com/r/agriculture", tip: "Post during market hours for relevance" },
        { name: "r/homesteading", url: "reddit.com/r/homesteading", tip: "468K subs — broader but still relevant" },
        { name: "r/grain", url: "reddit.com/r/grain", tip: "Smaller but highly targeted" },
      ],
      postDays: "Monday (market week start) and Thursday",
    },
    facebook: {
      groups: [
        { name: "Grain Farmers of America", members: "31K", tip: "Post during market hours for context" },
        { name: "US Corn Growers Network", members: "12K", tip: "Specific commodity angle (corn)" },
        { name: "American Farm Bureau Members", members: "45K", tip: "Broader farm audience" },
        { name: "Soybean Growers Network", members: "8K", tip: "Highly targeted, less competition" },
      ],
    },
    linkedin: {
      searchTerms: ["grain farmer", "farm operator", "agricultural operations manager", "commodity trader"],
      approach: "Simple message: 'Built a $79/mo SMS price alert for corn/soybeans. Text you when your target hits.'",
    },
    coldEmail: {
      subject: "Text alert when [commodity] hits $X — built for grain farmers",
      targetTitle: "Farm Owner / Grain Operations Manager",
    },
  },
  {
    id: "podcast",
    name: "Podcast Show Notes",
    price: "$49/mo",
    niche: "Podcast hosts needing SEO-optimized show notes",
    tagline: "Full show notes generated from your actual episode transcript",
    reddit: {
      subs: [
        { name: "r/podcasting", url: "reddit.com/r/podcasting", tip: "Post in 'automation' or 'tools' threads" },
        { name: "r/podcasters", url: "reddit.com/r/podcasters", tip: "Offer a free sample show notes generation" },
        { name: "r/PodcastRecording", url: "reddit.com/r/PodcastRecording", tip: "More technical audience, detail the transcription → notes pipeline" },
        { name: "r/NewTubers", url: "reddit.com/r/NewTubers", tip: "Cross-post: YouTube descriptions too" },
      ],
      postDays: "Wednesday (mid-week podcast release days)",
    },
    facebook: {
      groups: [
        { name: "Podcast Host Community", members: "67K", tip: "Offer to generate sample from their latest RSS episode" },
        { name: "Podcasters Support Group", members: "45K", tip: "Lead with 'Never write show notes again'" },
        { name: "Female Podcasters Unite", members: "38K", tip: "High engagement, very active community" },
        { name: "Podcast Launch Community", members: "52K", tip: "New podcasters who haven't established a workflow yet" },
      ],
    },
    linkedin: {
      searchTerms: ["podcast host", "podcast producer", "content creator", "media personality"],
      approach: "DM with a sample of their own show notes generated from their RSS feed — this personalization converts very highly",
    },
    coldEmail: {
      subject: "I generated show notes for your [Episode Title] episode",
      targetTitle: "Podcast Host / Producer",
    },
  },
  {
    id: "video-scripts",
    name: "AI Video Scripts",
    price: "$39/mo",
    niche: "YouTube and TikTok creators needing scripts",
    tagline: "Niche-specific video scripts in 60 seconds — not generic templates",
    reddit: {
      subs: [
        { name: "r/youtubers", url: "reddit.com/r/youtubers", tip: "Post an example script in comments" },
        { name: "r/NewTubers", url: "reddit.com/r/NewTubers", tip: "200K subs — creators just starting" },
        { name: "r/TikTokCreators", url: "reddit.com/r/TikTokCreators", tip: "Demo generating a script live" },
        { name: "r/ContentCreators", url: "reddit.com/r/ContentCreators", tip: "Broad creative audience" },
      ],
      postDays: "Sunday (creators plan content for the week)",
    },
    facebook: {
      groups: [
        { name: "YouTube Creators Community", members: "122K", tip: "Demo generating a script live in a video" },
        { name: "TikTok Creators & Influencers", members: "87K", tip: "Short-form specific scripts" },
        { name: "Faceless YouTube Creators", members: "34K", tip: "Highly targeted — needs scripts the most" },
        { name: "Content Creator Collective", members: "58K", tip: "Show before/after script quality" },
      ],
    },
    linkedin: {
      searchTerms: ["content creator", "YouTube creator", "video producer", "digital creator"],
      approach: "Show a sample script for their niche — search their LinkedIn for their content topic",
    },
    coldEmail: {
      subject: "Script for your [niche] channel — generated in 60 seconds",
      targetTitle: "Content Creator / YouTuber",
    },
  },
];

// ─── AI copy generator using OpenRouter ──────────────────────────────────────
async function generateMarketingCopy(
  product: ProductMarketing,
  platform: "reddit" | "facebook" | "linkedin" | "email"
): Promise<string> {
  const prompts: Record<string, string> = {
    reddit: `Write a Reddit post for the product "${product.name}" (${product.price}/month).
Tagline: ${product.tagline}
Target subreddit style: genuine, helpful, not spammy.
Keep it under 200 words. Be conversational. Lead with value, not the product.
Format: just the post text, no markdown headers.`,
    facebook: `Write a Facebook group post for "${product.name}" (${product.price}/month).
Tagline: ${product.tagline}
Style: casual, community-friendly. Hook with a pain point.
Include a soft CTA at the end (DM, comment, or link in bio).
Keep under 150 words.`,
    linkedin: `Write a LinkedIn post for "${product.name}" (${product.price}/month).
Tagline: ${product.tagline}
Target: ${product.linkedin.searchTerms.join(", ")}
Style: professional but not corporate. First line MUST hook.
Include a subtle CTA. 150-200 words.`,
    email: `Write a cold email for "${product.name}" (${product.price}/month).
Subject line: ${product.coldEmail.subject}
Target title: ${product.coldEmail.targetTitle}
Tagline: ${product.tagline}
Format:
Subject: [subject line]
[2-3 sentence email body — proof-before-pitch style, no fluff]
[CTA: one specific next step]`,
  };

  // Try to use the OpenRouter API key from env (if available in frontend)
  // Since we're in the browser, we'll construct a demo response if no key
  const prompt = prompts[platform];

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY ?? ""}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://detroitwebagent.com",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite:free",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? generateFallback(product, platform);
    }
  } catch { /* fall through */ }

  return generateFallback(product, platform);
}

function generateFallback(product: ProductMarketing, platform: string): string {
  const taglines: Record<string, string> = {
    reddit: `I've been using AI to generate industry-specific social captions for my clients and it's been a game changer.

Most AI content feels generic. The thing that actually works is when it's tuned to your specific vertical — a plumber gets completely different copy than a dentist.

If anyone's struggling with content calendars or just needs consistent posts without the time investment, ${product.name} does ${product.tagline.toLowerCase()}.

Happy to answer questions or generate a sample for your niche.`,
    facebook: `Quick question for this group — how much time do you spend on social media content every week?

For most of our clients it's 3-4 hours. We cut that down to about 10 minutes using ${product.name}.

${product.tagline}.

${product.price}/month, 7-day free trial. DM me if you want to see what it generates for your specific industry. 👋`,
    linkedin: `Most businesses I talk to are spending 3-4 hours per week on social content.

Not because they love it. Because they feel like they have to.

We built ${product.name} to change that: ${product.tagline}.

It's not generic AI output — it's industry-specific content that actually sounds like your business.

${product.price}/month. First month free if you want to try it.

Drop a comment or DM me — happy to generate a sample for your industry.`,
    email: `Subject: ${product.coldEmail.subject}

Hi [Name],

${product.tagline}. Most [industry] businesses we work with spend 3-4 hours a week on content — we cut that to under 10 minutes.

Worth a 5-minute look? I can generate a sample set of captions for your specific business this week.

— Matt
Detroit Web Agency | detroitwebagent.com`,
  };
  return taglines[platform] ?? `Sample copy for ${product.name} on ${platform}`;
}

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="outline" size="sm" onClick={copy}>
      {copied ? <><CheckCheck className="w-3 h-3 mr-1" /> Copied</> : <><Copy className="w-3 h-3 mr-1" /> Copy</>}
    </Button>
  );
}

// ─── Product panel ────────────────────────────────────────────────────────────
function ProductPanel({ product }: { product: ProductMarketing }) {
  const { toast } = useToast();
  const [generated, setGenerated] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState<string | null>(null);

  async function generate(platform: "reddit" | "facebook" | "linkedin" | "email") {
    setGenerating(platform);
    try {
      const copy = await generateMarketingCopy(product, platform);
      setGenerated(prev => ({ ...prev, [platform]: copy }));
    } catch (e) {
      toast({ title: "Error generating copy", description: String(e), variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="reddit">
        <TabsList className="w-full">
          <TabsTrigger value="reddit" className="flex-1">
            <MessageSquare className="w-3 h-3 mr-1" /> Reddit
          </TabsTrigger>
          <TabsTrigger value="facebook" className="flex-1">
            <Users className="w-3 h-3 mr-1" /> Facebook
          </TabsTrigger>
          <TabsTrigger value="linkedin" className="flex-1">
            <Share2 className="w-3 h-3 mr-1" /> LinkedIn
          </TabsTrigger>
          <TabsTrigger value="email" className="flex-1">
            <Mail className="w-3 h-3 mr-1" /> Cold Email
          </TabsTrigger>
        </TabsList>

        {/* Reddit */}
        <TabsContent value="reddit">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm text-gray-700 mb-2">Where to post</h3>
              <div className="grid grid-cols-2 gap-2">
                {product.reddit.subs.map(sub => (
                  <div key={sub.name} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{sub.name}</span>
                      <a href={`https://${sub.url}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3 text-gray-400" />
                      </a>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{sub.tip}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Best days: <strong>{product.reddit.postDays}</strong>
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm text-gray-700">Post Copy</h3>
                <div className="flex gap-2">
                  {generated.reddit && <CopyButton text={generated.reddit} />}
                  <Button
                    size="sm"
                    onClick={() => generate("reddit")}
                    disabled={generating === "reddit"}
                  >
                    {generating === "reddit"
                      ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Generating...</>
                      : <><Zap className="w-3 h-3 mr-1" /> Generate</>
                    }
                  </Button>
                </div>
              </div>
              <Textarea
                value={generated.reddit ?? ""}
                onChange={e => setGenerated(prev => ({ ...prev, reddit: e.target.value }))}
                placeholder="Click Generate to create Reddit post copy with AI..."
                rows={8}
                className="font-mono text-sm"
              />
            </div>
          </div>
        </TabsContent>

        {/* Facebook */}
        <TabsContent value="facebook">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm text-gray-700 mb-2">Groups to post in</h3>
              <div className="grid grid-cols-2 gap-2">
                {product.facebook.groups.map(group => (
                  <div key={group.name} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{group.name}</span>
                      <Badge variant="outline" className="text-xs">{group.members}</Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{group.tip}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm text-gray-700">Post Copy</h3>
                <div className="flex gap-2">
                  {generated.facebook && <CopyButton text={generated.facebook} />}
                  <Button
                    size="sm"
                    onClick={() => generate("facebook")}
                    disabled={generating === "facebook"}
                  >
                    {generating === "facebook"
                      ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Generating...</>
                      : <><Zap className="w-3 h-3 mr-1" /> Generate</>
                    }
                  </Button>
                </div>
              </div>
              <Textarea
                value={generated.facebook ?? ""}
                onChange={e => setGenerated(prev => ({ ...prev, facebook: e.target.value }))}
                placeholder="Click Generate to create Facebook group post copy..."
                rows={6}
                className="font-mono text-sm"
              />
            </div>
          </div>
        </TabsContent>

        {/* LinkedIn */}
        <TabsContent value="linkedin">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm text-gray-700 mb-2">LinkedIn targeting</h3>
              <div className="p-3 border rounded-lg bg-blue-50">
                <p className="text-sm text-blue-800">
                  <strong>Search terms:</strong> {product.linkedin.searchTerms.join(" · ")}
                </p>
                <p className="text-sm text-blue-700 mt-2">
                  <strong>Approach:</strong> {product.linkedin.approach}
                </p>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm text-gray-700">Post Copy</h3>
                <div className="flex gap-2">
                  {generated.linkedin && <CopyButton text={generated.linkedin} />}
                  <Button
                    size="sm"
                    onClick={() => generate("linkedin")}
                    disabled={generating === "linkedin"}
                  >
                    {generating === "linkedin"
                      ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Generating...</>
                      : <><Zap className="w-3 h-3 mr-1" /> Generate</>
                    }
                  </Button>
                </div>
              </div>
              <Textarea
                value={generated.linkedin ?? ""}
                onChange={e => setGenerated(prev => ({ ...prev, linkedin: e.target.value }))}
                placeholder="Click Generate to create LinkedIn post copy..."
                rows={8}
                className="font-mono text-sm"
              />
            </div>
          </div>
        </TabsContent>

        {/* Cold Email */}
        <TabsContent value="email">
          <div className="space-y-4">
            <div className="p-3 border rounded-lg bg-gray-50">
              <p className="text-sm text-gray-700">
                <strong>Suggested subject:</strong> {product.coldEmail.subject}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>Target title:</strong> {product.coldEmail.targetTitle}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Cold email runs automatically via <code className="bg-gray-200 px-1 rounded">dwa-product-blast</code> (200/day). Use this copy for manual outreach variants.
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm text-gray-700">Email Copy</h3>
                <div className="flex gap-2">
                  {generated.email && <CopyButton text={generated.email} />}
                  <Button
                    size="sm"
                    onClick={() => generate("email")}
                    disabled={generating === "email"}
                  >
                    {generating === "email"
                      ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Generating...</>
                      : <><Zap className="w-3 h-3 mr-1" /> Generate</>
                    }
                  </Button>
                </div>
              </div>
              <Textarea
                value={generated.email ?? ""}
                onChange={e => setGenerated(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Click Generate to create cold email copy..."
                rows={10}
                className="font-mono text-sm"
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function MarketingHub() {
  const navigate = useNavigate();
  const [selectedProduct, setSelectedProduct] = useState(PRODUCTS[0].id);

  const product = PRODUCTS.find(p => p.id === selectedProduct) ?? PRODUCTS[0];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dwa-admin/services")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Services
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Marketing Hub</h1>
            <p className="text-sm text-gray-500">Generate Reddit, Facebook, LinkedIn, and email copy for every product</p>
          </div>
        </div>

        {/* Note about automation */}
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-3">
              <Zap className="w-4 h-4 text-green-600 mt-0.5" />
              <div className="text-sm text-green-800">
                <strong>Auto-posting:</strong> LinkedIn posts can be automated (API allows own-profile posts). Cold email runs via <code className="bg-green-100 px-1 rounded">dwa-product-blast</code> (200/day automated). Reddit and Facebook must be manual (APIs banned for auto-posting). Use the generators below to create the copy, then paste it in.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Product selector */}
        <div className="flex items-center gap-3 mb-6">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Select Product:</label>
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCTS.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} — {p.price}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-green-700 border-green-200">
            {product.price}
          </Badge>
        </div>

        {/* Product tagline */}
        <Card className="mb-6">
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-gray-600">
              <strong>{product.name}:</strong> {product.tagline}
            </p>
            <p className="text-xs text-gray-400 mt-1">Target: {product.niche}</p>
          </CardContent>
        </Card>

        {/* Marketing panel */}
        <Card>
          <CardHeader>
            <CardTitle>{product.name} — Marketing Copy Generator</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductPanel product={product} />
          </CardContent>
        </Card>

        {/* YouTube Shorts link */}
        <Card className="mt-6 border-green-200">
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-gray-700 flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-600" />
              <strong>YouTube Shorts are your main driver.</strong> Fire a {product.name} niche Short from the{" "}
              <Button
                variant="link"
                className="p-0 h-auto"
                onClick={() => navigate("/dwa-admin/shorts")}
              >
                Shorts Manager →
              </Button>
              {" "}then share it with this post copy.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
