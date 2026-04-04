import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Copy, Check, ExternalLink, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Brain } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const SERVICES = [
  {
    key: "contractor-leads",
    name: "Contractor Lead Gen",
    price: "$399/mo",
    tagline: "Never pay Angi again",
    color: "text-orange-400",
    borderColor: "border-orange-400/30",
    keywords: "exclusive contractor leads, roofing leads near me, HVAC leads, plumbing leads, electrician leads, contractor lead generation service",
    url: "https://mattmichelstraining.com/contractor-leads",
    audience: "Roofing, HVAC, plumbing, electrical contractors",
  },
  {
    key: "ai-phone",
    name: "AI Phone Answering",
    price: "$149/mo",
    tagline: "Never miss a lead again",
    color: "text-blue-400",
    borderColor: "border-blue-400/30",
    keywords: "AI phone answering service for small business, 24/7 virtual receptionist, never miss a business call, automated phone answering",
    url: "https://mattmichelstraining.com/ai-phone-answering",
    audience: "Service businesses — plumbers, HVAC, restaurants, salons, contractors",
  },
  {
    key: "missed-call",
    name: "Missed Call Text-Back",
    price: "$49/mo",
    tagline: "Instant ROI, zero work",
    color: "text-green-400",
    borderColor: "border-green-400/30",
    keywords: "missed call text back service, automatic text reply missed call, follow up missed calls automatically",
    url: "https://mattmichelstraining.com/missed-call-text-back",
    audience: "All service businesses with phone inquiries",
  },
  {
    key: "linkedin-ghostwriting",
    name: "LinkedIn Ghostwriting",
    price: "$249/mo",
    tagline: "Inbound leads on autopilot",
    color: "text-sky-400",
    borderColor: "border-sky-400/30",
    keywords: "LinkedIn ghostwriter service, LinkedIn content creation for executives, personal brand LinkedIn posts done for you",
    url: "https://mattmichelstraining.com/linkedin-ghostwriting",
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
    url: "https://mattmichelstraining.com/gbp-management",
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

  return (
    <div className="space-y-6">
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
