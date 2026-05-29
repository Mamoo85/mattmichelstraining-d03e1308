import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Copy, Check, ExternalLink, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Brain } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminHelpCard } from "./AdminHelpCard";
import { getAdminGuide } from "@/lib/admin-guides";

// ── Ad-Ready Landing Pages ─────────────────────────────────────────────────
const DWA_DOMAIN = "https://www.detroitwebagent.com";
const M2_DOMAIN  = "https://www.mattmichelstraining.com";

const AD_PAGES = [
  { name: "Missed Call (Ad)", path: "/ad/missed-call", tag: "Google + Meta", domain: DWA_DOMAIN },
  { name: "SiteRadar (Ad)", path: "/ad/site-radar", tag: "Meta + Facebook", domain: DWA_DOMAIN },
  { name: "Dead Leads (Ad)", path: "/ad/dead-leads", tag: "Facebook Lead Gen", domain: DWA_DOMAIN },
  { name: "Trade Radar (Ad)", path: "/ad/trade-radar", tag: "Google + Facebook", domain: DWA_DOMAIN },
  { name: "Digital Foundation (Ad)", path: "/ad/digital-foundation", tag: "Google + Meta", domain: DWA_DOMAIN },
  { name: "Free Audit (Ad)", path: "/ad/free-audit", tag: "Meta", domain: DWA_DOMAIN },
  { name: "Visibility Score", path: "/visibility-score", tag: "Sales Demo", domain: DWA_DOMAIN },
  { name: "Digital Foundation", path: "/digital-foundation", tag: "Organic", domain: DWA_DOMAIN },
  { name: "Free Audit", path: "/ai-website-audit", tag: "Organic", domain: DWA_DOMAIN },
  { name: "Portfolio", path: "/portfolio", tag: "Social Proof", domain: DWA_DOMAIN },
];

const DOMAIN = M2_DOMAIN;

const SERVICES = [
  {
    key: "dead-lead-reactivation",
    name: "Dead Lead Reactivation",
    price: "$50/yes (1st FREE)",
    tagline: "Your old dead leads are worth real money",
    color: "text-red-400",
    borderColor: "border-red-400/30",
    keywords: "reactivate old leads, dead lead follow up service, follow up old customers automatically, win back lost leads",
    url: "https://www.detroitwebagent.com/ad/dead-leads",
    audience: "Contractors, HVAC, plumbers, roofers — anyone with a list of old unresponsive leads",
  },
  {
    key: "missed-call-catch",
    name: "Missed-Call Catch",
    price: "$99/mo + 7-day trial",
    tagline: "Every missed call is a lost job",
    color: "text-green-400",
    borderColor: "border-green-400/30",
    keywords: "missed call text back service, auto text missed call, missed call automation small business, never miss a call",
    url: "https://www.detroitwebagent.com/ad/missed-call",
    audience: "All service businesses — contractors, HVAC, salons, restaurants, medical offices",
  },
  {
    key: "site-radar",
    name: "SiteRadar",
    price: "$49/mo + 7-day trial",
    tagline: "See who visits your site before they call your competitor",
    color: "text-cyan-400",
    borderColor: "border-cyan-400/30",
    keywords: "who visits my website, website visitor tracking small business, see who visits my site, B2B visitor identification",
    url: "https://www.detroitwebagent.com/ad/site-radar",
    audience: "B2B service businesses, agencies, contractors — anyone doing outbound sales",
  },
  {
    key: "trade-radar",
    name: "Trade Radar",
    price: "$149/mo + 7-day trial",
    tagline: "Daily permit pulls, storm damage alerts, homeowner signals",
    color: "text-orange-400",
    borderColor: "border-orange-400/30",
    keywords: "contractor lead generation, roofing leads, HVAC leads daily, exclusive contractor leads, permit lead service",
    url: "https://www.detroitwebagent.com/ad/trade-radar",
    audience: "Roofing, HVAC, plumbing, electrical, exterior contractors",
  },
  {
    key: "mortgage-radar",
    name: "Mortgage Radar",
    price: "$399/mo + 7-day trial",
    tagline: "Foreclosure + FSBO signals every morning",
    color: "text-purple-400",
    borderColor: "border-purple-400/30",
    keywords: "mortgage lead generation, foreclosure leads, FSBO leads loan officers, probate leads mortgage, trigger leads alternative",
    url: "https://www.detroitwebagent.com/mortgage-radar",
    audience: "Mortgage loan officers, real estate agents, investors",
  },
  {
    key: "ai-phone",
    name: "AI Phone Answering",
    price: "$149/mo + 7-day trial",
    tagline: "While you're on a job, your phone keeps answering",
    color: "text-blue-400",
    borderColor: "border-blue-400/30",
    keywords: "AI phone answering service for small business, 24/7 virtual receptionist, never miss a business call, automated phone answering",
    url: "https://www.detroitwebagent.com/ai-phone-answering",
    audience: "Service businesses — plumbers, HVAC, restaurants, salons, contractors",
  },
  {
    key: "contractor-leads",
    name: "Contractor Lead Gen",
    price: "$399/mo",
    tagline: "Exclusive leads — no Angi, no HomeAdvisor",
    color: "text-amber-400",
    borderColor: "border-amber-400/30",
    keywords: "exclusive contractor leads, roofing leads near me, HVAC leads, plumbing leads, electrician leads, contractor lead generation service",
    url: "https://www.detroitwebagent.com/contractor-leads",
    audience: "Roofing, HVAC, plumbing, electrical contractors — warm not cold",
  },
  {
    key: "ai-ads-copy",
    name: "AI Ads Copy Generator",
    price: "$19.99/mo",
    tagline: "Fresh Google Ads copy every month, done for you",
    color: "text-pink-400",
    borderColor: "border-pink-400/30",
    keywords: "AI Google Ads copy generator, automated ad copy service, AI advertising copy for small business",
    url: "https://www.detroitwebagent.com/ai-ads-copy",
    audience: "Small business owners running Google or Facebook ads",
  },
  {
    key: "linkedin-ghostwriting",
    name: "LinkedIn Ghostwriting",
    price: "$249/mo",
    tagline: "Inbound leads on autopilot",
    color: "text-sky-400",
    borderColor: "border-sky-400/30",
    keywords: "LinkedIn ghostwriter service, LinkedIn content creation for executives, personal brand LinkedIn posts done for you",
    url: "https://www.detroitwebagent.com/linkedin-ghostwriting",
    audience: "B2B executives, consultants, coaches, sales professionals",
  },
  {
    key: "gbp-management",
    name: "GBP Management",
    price: "$49–99/mo",
    tagline: "Rank higher, do nothing",
    color: "text-yellow-400",
    borderColor: "border-yellow-400/30",
    keywords: "Google Business Profile management service, GBP posting service, local SEO management for small business",
    url: "https://www.detroitwebagent.com/gbp-management",
    audience: "Local service businesses wanting more Google visibility",
  },
];

const CopyButton = ({ text, label = "" }: { text: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] border border-border rounded hover:border-primary/40 transition-colors text-muted-foreground hover:text-foreground"
    >
      {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
      {label || "Copy"}
    </button>
  );
};

const AdminAdCampaigns = () => {
  const [campaigns, setCampaigns] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const generate = async (service: typeof SERVICES[0]) => {
    setLoading((p) => ({ ...p, [service.key]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("generate-ad-campaign", {
        body: {
          service: service.name,
          keywords: service.keywords,
          url: service.url,
          audience: service.audience,
          price: service.price,
          tagline: service.tagline,
          budget: 200,
        },
      });
      if (error) throw error;
      setCampaigns((p) => ({ ...p, [service.key]: data.campaign }));
      setExpanded(service.key);
    } catch (e: any) {
      toast.error("Campaign generation failed: " + (e.message || "Unknown error"));
    } finally {
      setLoading((p) => ({ ...p, [service.key]: false }));
    }
  };

  const queryClient = useQueryClient();

  // Selma's campaign queue
  const { data: selmaQueue } = useQuery({
    queryKey: ["selma-campaign-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_campaign_queue" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as any[];
    },
  });

  const updateCampaignStatus = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const { error } = await supabase
        .from("ad_campaign_queue" as any)
        .update({ status, admin_notes: notes || null, reviewed_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["selma-campaign-queue"] });
      toast.success("Campaign updated");
    },
  });

  const pendingCampaigns = selmaQueue?.filter((c: any) => c.status === "pending") || [];

  const guide = getAdminGuide("ad-campaigns");

  return (
    <div className="space-y-6">
      {guide && <AdminHelpCard id={guide.id} title={guide.title} body={guide.body} tips={guide.tips} />}

      {/* Ad-Ready URLs */}
      <div>
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          🎯 Ad-Ready Landing Pages
          <button
            onClick={() => {
              navigator.clipboard.writeText(AD_PAGES.map(p => `${p.name}: ${p.domain ?? DOMAIN}${p.path}`).join("\n"));
              toast.success("All URLs copied");
            }}
            className="text-[10px] text-primary hover:underline font-normal"
          >
            Copy all
          </button>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
          {AD_PAGES.map((p) => (
            <div key={p.path} className="flex items-center justify-between p-2 rounded border border-border bg-card">
              <div className="min-w-0">
                <span className="text-xs font-bold">{p.name}</span>
                <span className="text-[9px] ml-1.5 px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{p.tag}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <CopyButton text={`${p.domain ?? DOMAIN}${p.path}`} label="URL" />
                <a href={p.path} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                  <ExternalLink size={11} />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selma's AI Campaign Queue */}
      {selmaQueue && selmaQueue.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Brain size={14} className="text-primary" />
            <h2 className="text-sm font-bold text-foreground">Selma's Campaign Proposals</h2>
            {pendingCampaigns.length > 0 && (
              <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold">
                {pendingCampaigns.length} PENDING
              </span>
            )}
          </div>
          <div className="space-y-2">
            {selmaQueue.map((campaign: any) => (
              <div key={campaign.id} className={`border rounded-lg p-3 ${
                campaign.status === "pending" ? "border-primary/40 bg-primary/5" :
                campaign.status === "approved" ? "border-green-500/30 bg-green-500/5" :
                "border-border bg-muted/20"
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">{campaign.service}</span>
                      <span className="text-[10px] text-muted-foreground">{campaign.platform}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                        campaign.status === "pending" ? "bg-yellow-500/20 text-yellow-400" :
                        campaign.status === "approved" ? "bg-green-500/20 text-green-400" :
                        "bg-red-500/20 text-red-400"
                      }`}>{campaign.status.toUpperCase()}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span>Budget: ${campaign.monthly_budget}/mo</span>
                      <span>CAC: ${campaign.projected_cac}</span>
                      <span>LTV: ${campaign.projected_ltv}</span>
                      <span className="text-green-400">{campaign.projected_roas}x ROAS</span>
                    </div>
                  </div>
                  {campaign.status === "pending" && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] gap-1 border-green-500/40 text-green-400 hover:bg-green-500/10"
                        onClick={() => updateCampaignStatus.mutate({ id: campaign.id, status: "approved" })}
                      >
                        <ThumbsUp size={10} /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] gap-1 border-red-500/40 text-red-400 hover:bg-red-500/10"
                        onClick={() => updateCampaignStatus.mutate({ id: campaign.id, status: "rejected", notes: "Not now" })}
                      >
                        <ThumbsDown size={10} /> Skip
                      </Button>
                    </div>
                  )}
                </div>
                {campaign.campaign_content && (
                  <details className="mt-2">
                    <summary className="text-[10px] text-primary cursor-pointer hover:underline">View full campaign</summary>
                    <pre className="mt-2 p-3 text-[10px] whitespace-pre-wrap font-mono bg-background/50 rounded border border-border max-h-[300px] overflow-y-auto">
                      {campaign.campaign_content}
                    </pre>
                  </details>
                )}
                <p className="text-[9px] text-muted-foreground mt-1">
                  {new Date(campaign.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-bold text-foreground">Ad Campaign Generator</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          One click → complete Google Ads + Facebook Ads campaign. Copy directly into Ads Manager.
        </p>
      </div>

      <div className="space-y-3">
        {SERVICES.map((s) => (
          <div key={s.key} className={`border rounded-lg overflow-hidden ${campaigns[s.key] ? s.borderColor : "border-border"}`}>
            {/* Header row */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-card">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${s.color}`}>{s.name}</span>
                    <span className="text-[10px] text-muted-foreground">{s.price}</span>
                    {campaigns[s.key] && (
                      <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-semibold">READY</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">{s.tagline}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {campaigns[s.key] && (
                  <>
                    <CopyButton text={campaigns[s.key]} label="Copy All" />
                    <a
                      href="https://ads.google.com/aw/campaigns"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                    >
                      Google Ads <ExternalLink size={9} />
                    </a>
                    <a
                      href="https://www.facebook.com/adsmanager/creation"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                    >
                      FB Ads <ExternalLink size={9} />
                    </a>
                    <button
                      onClick={() => setExpanded(expanded === s.key ? null : s.key)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {expanded === s.key ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </>
                )}
                <Button
                  size="sm"
                  variant={campaigns[s.key] ? "outline" : "default"}
                  className="text-[11px] h-7 gap-1.5"
                  disabled={loading[s.key]}
                  onClick={() => generate(s)}
                >
                  {loading[s.key] ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    "⚡"
                  )}
                  {campaigns[s.key] ? "Regenerate" : "Generate"}
                </Button>
              </div>
            </div>

            {/* Campaign output */}
            {expanded === s.key && campaigns[s.key] && (
              <div className="border-t border-border">
                <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Campaign Output</span>
                  <CopyButton text={campaigns[s.key]} label="Copy full campaign" />
                </div>
                <pre className="p-4 text-[11px] text-foreground/85 whitespace-pre-wrap font-mono leading-relaxed max-h-[500px] overflow-y-auto bg-background/50">
                  {campaigns[s.key]}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-4 border border-dashed border-border rounded-lg bg-muted/20">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">How to use:</strong> Hit Generate, copy the output, open Google Ads or Facebook Ads Manager,
          create a new Search/Traffic campaign, and paste the headlines, descriptions, and keywords directly in.
          Start with $5–10/day ($150–300/mo). Watch results for 2 weeks before scaling.
        </p>
      </div>
    </div>
  );
};

export default AdminAdCampaigns;
