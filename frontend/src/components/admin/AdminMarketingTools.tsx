import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, ExternalLink, Video, Image, BarChart2, TrendingUp, Zap } from "lucide-react";
import AdminAdCampaigns from "./AdminAdCampaigns";
import AdminClientAttribution from "./AdminClientAttribution";

const TABS = [
  { key: "ad-copy",       label: "⚡ Ad Copy",       icon: Zap },
  { key: "creatives",     label: "🖼 Creatives",      icon: Image },
  { key: "video-ads",     label: "🎬 Video Ads",      icon: Video },
  { key: "meta-campaigns",label: "📈 Meta Campaigns", icon: BarChart2 },
  { key: "attribution",   label: "📊 Attribution",    icon: TrendingUp },
] as const;

type TabKey = typeof TABS[number]["key"];

const CREATIVE_SERVICES = [
  { key: "missed-call", name: "Missed-Call Catch", brand: "dwa" },
  { key: "site-radar", name: "SiteRadar", brand: "dwa" },
  { key: "trade-radar", name: "Trade Radar", brand: "dwa" },
  { key: "dead-leads", name: "Dead Lead Reactivation", brand: "dwa" },
  { key: "mortgage-radar", name: "Mortgage Radar", brand: "dwa" },
  { key: "ai-phone", name: "AI Phone Answering", brand: "dwa" },
  { key: "contractor-leads", name: "Contractor Leads", brand: "dwa" },
];

const VIDEO_SERVICES = [
  { key: "missed-call", name: "Missed-Call Catch", script: "Every missed call is a lost job. We text them back in 60 seconds — automatically. Never lose another lead. Try it free for 7 days at Detroit Web Agency dot com." },
  { key: "site-radar", name: "SiteRadar", script: "See every company that visited your website today — before they call your competitor. SiteRadar reveals anonymous business visitors so you can reach out first. Try it free at Detroit Web Agency dot com." },
  { key: "trade-radar", name: "Trade Radar", script: "Daily permit pulls, storm damage alerts, and homeowner signals delivered every morning. Stop chasing leads — let the signals come to you with Trade Radar. Try it free at Detroit Web Agency dot com." },
  { key: "dead-leads", name: "Dead Lead Reactivation", script: "Your dead leads are worth real money. We text them a personalized message — you only pay for the ones that say yes. First reactivation is on us. Start free at Detroit Web Agency dot com." },
];

function CreativesTab() {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, any>>({});

  const generate = async (svc: typeof CREATIVE_SERVICES[0]) => {
    setLoading((p) => ({ ...p, [svc.key]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("ad-creative-studio", {
        body: { product: svc.name, brand: svc.brand },
      });
      if (error) throw error;
      setResults((p) => ({ ...p, [svc.key]: data }));
      toast.success(`Creative generated for ${svc.name}`);
    } catch (e: any) {
      toast.error(e.message || "Creative generation failed");
    } finally {
      setLoading((p) => ({ ...p, [svc.key]: false }));
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Generate ad creative copy (headline, body, CTA) for each DWA product via AI.
      </p>
      <div className="space-y-2">
        {CREATIVE_SERVICES.map((svc) => (
          <div key={svc.key} className="border border-border rounded-lg p-3 bg-card">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold">{svc.name}</span>
              <Button size="sm" variant="outline" className="text-[11px] h-7 gap-1.5" disabled={loading[svc.key]} onClick={() => generate(svc)}>
                {loading[svc.key] ? <Loader2 size={11} className="animate-spin" /> : "🖼"}
                {results[svc.key] ? "Regenerate" : "Generate"}
              </Button>
            </div>
            {results[svc.key] && (
              <pre className="mt-2 p-2 text-[10px] whitespace-pre-wrap font-mono bg-background/50 rounded border border-border max-h-[200px] overflow-y-auto">
                {typeof results[svc.key] === "string" ? results[svc.key] : JSON.stringify(results[svc.key], null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function VideoAdsTab() {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState<Record<string, string>>({});

  const { data: jobs } = useQuery({
    queryKey: ["heygen-jobs-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("heygen_jobs" as any)
        .select("id, status, video_url, created_at, source")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 30_000,
  });

  const submit = async (svc: typeof VIDEO_SERVICES[0], brand = "dwa") => {
    setLoading((p) => ({ ...p, [svc.key]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("dwa-video-ad", {
        body: { brand, script: svc.script },
      });
      if (error) throw error;
      setSubmitted((p) => ({ ...p, [svc.key]: data?.videoId ?? "submitted" }));
      toast.success(`Video job submitted for ${svc.name}`);
    } catch (e: any) {
      toast.error(e.message || "Video submission failed");
    } finally {
      setLoading((p) => ({ ...p, [svc.key]: false }));
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Submit HeyGen AI video ad jobs. Matt's avatar (DWA). Jobs render in ~5 min.</p>
        {VIDEO_SERVICES.map((svc) => (
          <div key={svc.key} className="border border-border rounded-lg p-3 bg-card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold">{svc.name}</span>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{svc.script}</p>
              </div>
              <Button size="sm" variant={submitted[svc.key] ? "outline" : "default"} className="text-[11px] h-7 gap-1.5 shrink-0" disabled={loading[svc.key]} onClick={() => submit(svc)}>
                {loading[svc.key] ? <Loader2 size={11} className="animate-spin" /> : "🎬"}
                {submitted[svc.key] ? "Resubmit" : "Submit"}
              </Button>
            </div>
            {submitted[svc.key] && (
              <p className="text-[10px] text-green-400 mt-1.5">Job ID: {submitted[svc.key]}</p>
            )}
          </div>
        ))}
      </div>

      {jobs && jobs.length > 0 && (
        <div>
          <h3 className="text-xs font-bold mb-2">Recent HeyGen Jobs</h3>
          <div className="space-y-1.5">
            {jobs.map((job: any) => (
              <div key={job.id} className="flex items-center justify-between gap-3 border border-border rounded px-3 py-2 bg-card text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                    job.status === "completed" ? "bg-green-500/20 text-green-400" :
                    job.status === "failed" ? "bg-red-500/20 text-red-400" :
                    "bg-yellow-500/20 text-yellow-400"
                  }`}>{job.status?.toUpperCase() ?? "PENDING"}</span>
                  <span className="text-muted-foreground truncate">{job.source || job.id}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted-foreground">{new Date(job.created_at).toLocaleDateString()}</span>
                  {job.video_url && (
                    <a href={job.video_url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-[10px]">
                      Watch <ExternalLink size={9} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetaCampaignsTab() {
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["meta-ad-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_ad_campaigns" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
    staleTime: 2 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
        <Loader2 size={14} className="animate-spin" /> Loading campaigns…
      </div>
    );
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm py-10 space-y-2">
        <p>No Meta campaigns logged yet.</p>
        <p className="text-xs">Campaigns created via the Meta Ads API will appear here automatically.</p>
        <a href="https://www.facebook.com/adsmanager" target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs inline-flex items-center gap-1">
          Open Meta Ads Manager <ExternalLink size={10} />
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_80px_80px_70px_70px_60px] gap-0 px-3 py-2 bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          <span>Campaign</span>
          <span>Brand</span>
          <span>Status</span>
          <span className="text-right">Spend</span>
          <span className="text-right">Clicks</span>
          <span className="text-right">ROAS</span>
        </div>
        <div className="divide-y divide-border">
          {campaigns.map((c: any) => {
            const spend = ((c.spend_cents ?? 0) / 100).toFixed(2);
            const roas = c.spend_cents > 0 && c.revenue_cents ? (c.revenue_cents / c.spend_cents).toFixed(1) : "—";
            return (
              <div key={c.id} className="grid grid-cols-[1fr_80px_80px_70px_70px_60px] gap-0 px-3 py-2.5 text-xs hover:bg-muted/20 transition-colors">
                <div className="min-w-0 pr-2">
                  <span className="font-medium text-foreground truncate block">{c.campaign_name || c.campaign_id || c.id}</span>
                </div>
                <span className="text-muted-foreground uppercase text-[10px]">{c.brand_slug || "dwa"}</span>
                <span className={`text-[10px] font-semibold ${c.status === "ACTIVE" ? "text-green-400" : "text-muted-foreground"}`}>{c.status || "—"}</span>
                <span className="text-right text-foreground">${spend}</span>
                <span className="text-right text-foreground">{(c.clicks ?? 0).toLocaleString()}</span>
                <span className={`text-right font-bold ${roas !== "—" && parseFloat(roas) >= 3 ? "text-green-400" : "text-foreground"}`}>{roas}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex gap-3 text-[10px]">
        <a href="https://www.facebook.com/adsmanager" target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
          Open Meta Ads Manager <ExternalLink size={9} />
        </a>
        <a href="https://ads.google.com/aw/campaigns" target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
          Google Ads <ExternalLink size={9} />
        </a>
      </div>
    </div>
  );
}

export default function AdminMarketingTools() {
  const [activeTab, setActiveTab] = useState<TabKey>("ad-copy");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-bold text-foreground">DWA Ad Command Center</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Generate campaigns, creatives, video ads, and track performance in one place.</p>
      </div>

      <div className="flex gap-1 flex-wrap border-b border-border pb-3">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === "ad-copy"        && <AdminAdCampaigns />}
        {activeTab === "creatives"      && <CreativesTab />}
        {activeTab === "video-ads"      && <VideoAdsTab />}
        {activeTab === "meta-campaigns" && <MetaCampaignsTab />}
        {activeTab === "attribution"    && <AdminClientAttribution />}
      </div>
    </div>
  );
}
