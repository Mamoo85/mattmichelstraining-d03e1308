import { ReactNode } from "react";
import { Flame, Snowflake, Sun, MapPin, Calendar, TrendingUp, ShieldCheck, ArrowUp, ArrowDown, Minus, Copy } from "lucide-react";
import { ProvenanceTooltip } from "./ProvenanceTooltip";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type SignalTier = "hot" | "warm" | "cool";

export interface MarketplaceLead {
  id: string;
  product: string;
  signal_type: string | null;
  signal_strength_tier: SignalTier | null;
  score: number | null;
  score_percentile: number | null;
  score_history?: Array<{ score: number; at: string }> | null;
  signal_velocity: number | null;
  zip_heat_index: number | null;
  days_on_radar: number | null;
  nearby_signal_count: number | null;
  equity_range_low_cents: number | null;
  equity_range_high_cents: number | null;
  year_built: number | null;
  last_sale_price_cents: number | null;
  last_sale_date: string | null;
  est_loan_low_cents: number | null;
  est_loan_high_cents: number | null;
  tcpa_clear: boolean | null;
  human_summary: string | null;
  buyer_type: string | null;
  suggested_opener: { sms?: string; email_subject?: string; email_body?: string; voicemail?: string } | null;
  provenance_source_urls: Array<{ field: string; url: string; fetched_at: string }> | null;
  provenance_sources?: Array<{ source?: string; field?: string; url?: string; fetched_at?: string }> | null;
  created_at: string;
  city: string | null;
  state: string | null;
  zip: string | null;
}

const TIER_CONFIG: Record<SignalTier, { label: string; icon: typeof Flame; color: string; bg: string; border: string }> = {
  hot: { label: "HOT", icon: Flame, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/40" },
  warm: { label: "WARM", icon: Sun, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/40" },
  cool: { label: "COOL", icon: Snowflake, color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/40" },
};

export function BuyerChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider bg-intel-teal/15 text-intel-teal border border-intel-teal/30 rounded">
      {children}
    </span>
  );
}

export function FreshnessBadge({ days }: { days: number | null }) {
  if (days === null) return null;
  const config =
    days <= 1 ? { label: "🟢 NEW", color: "text-emerald-400" } :
    days <= 3 ? { label: "🟡 FRESH", color: "text-yellow-400" } :
    days <= 7 ? { label: "🟠 AGING", color: "text-orange-400" } :
                { label: "🔴 STALE", color: "text-red-400" };
  return (
    <span className={cn("text-[10px] font-mono uppercase tracking-wider", config.color)}>
      {config.label} · {days}d
    </span>
  );
}

export function TierBadge({ tier }: { tier: SignalTier | null }) {
  if (!tier) return null;
  const cfg = TIER_CONFIG[tier];
  const Icon = cfg.icon;
  return (
    <div className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border font-mono text-xs uppercase tracking-wider", cfg.bg, cfg.border, cfg.color, tier === "hot" && "animate-pulse-flame")}>
      <Icon className="w-3.5 h-3.5" />
      <span className="font-bold">{cfg.label}</span>
      <span className="text-foreground/60 normal-case tracking-normal">· DWA Signal</span>
    </div>
  );
}

export function ScoreTrend({ history }: { history?: Array<{ score: number; at: string }> | null }) {
  if (!history || history.length < 2) return null;
  const sorted = [...history].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const first = sorted[0].score;
  const last = sorted[sorted.length - 1].score;
  const delta = last - first;
  const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
  const color = delta > 0 ? "text-emerald-400" : delta < 0 ? "text-orange-400" : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center text-[10px] font-mono", color)} title={`Score trend: ${delta > 0 ? "+" : ""}${delta} over ${sorted.length} scans`}>
      <Icon className="w-3 h-3" />
    </span>
  );
}

export function ScoreBars({ score, percentile, history }: { score: number | null; percentile: number | null; history?: Array<{ score: number; at: string }> | null }) {
  if (!score) return null;
  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">Lead Score</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs bg-popover border-border">
              <div className="text-xs space-y-1">
                <div className="font-mono text-intel-teal">DWA Composite Score</div>
                <p className="text-foreground/80">Combines signal strength, recency, equity confidence, NOAA storm history, and multi-signal stacking. Capped at 10. Updated each scanner run.</p>
              </div>
            </TooltipContent>
          </Tooltip>
          <span className="text-intel-teal font-bold flex items-center gap-1">
            {score}/10{percentile && ` · top ${100 - percentile}%`}
            <ScoreTrend history={history} />
          </span>
        </div>
        <div className="flex gap-0.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className={cn("h-1.5 flex-1 rounded-sm", i < score ? "bg-intel-teal" : "bg-muted/30")} />
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

export function CopyAllOpenerButton({ opener }: { opener: MarketplaceLead["suggested_opener"] }) {
  if (!opener) return null;
  const handleCopy = async () => {
    const block = [
      opener.sms && `--- SMS ---\n${opener.sms}`,
      opener.email_subject && `--- EMAIL ---\nSubject: ${opener.email_subject}\n${opener.email_body || ""}`,
      opener.voicemail && `--- VOICEMAIL ---\n${opener.voicemail}`,
    ].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(block);
      toast.success("All openers copied — paste & send manually (TCPA: verify EBR first).");
    } catch {
      toast.error("Could not copy");
    }
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider rounded border border-intel-teal/40 text-intel-teal hover:bg-intel-teal/10 transition-colors"
    >
      <Copy className="w-3 h-3" /> Copy all openers
    </button>
  );
}

export function IntelPanel({ title, children, source, sourceUrl, fetchedAt }: { title: string; children: ReactNode; source?: string; sourceUrl?: string | null; fetchedAt?: string | null }) {
  return (
    <div className="border border-border/60 rounded-md bg-card/50 backdrop-blur-sm p-3 space-y-1.5">
      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        <span>{title}</span>
        {source && <ProvenanceTooltip source={source} url={sourceUrl} fetchedAt={fetchedAt} />}
      </div>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

export function EquityPanel({ lead }: { lead: MarketplaceLead }) {
  if (!lead.equity_range_low_cents) return null;
  const low = Math.round(lead.equity_range_low_cents / 100000) * 1000;
  const high = Math.round(lead.equity_range_high_cents! / 100000) * 1000;
  return (
    <IntelPanel title="Equity Estimate" source="Detroit ArcGIS Parcels" sourceUrl={lead.provenance_source_urls?.[0]?.url} fetchedAt={lead.provenance_source_urls?.[0]?.fetched_at}>
      <div className="font-bold text-emerald-400 text-lg">${low.toLocaleString()}–${high.toLocaleString()}</div>
      {lead.year_built && <div className="text-xs text-muted-foreground mt-0.5">Built {lead.year_built}{lead.last_sale_date ? ` · last sold ${new Date(lead.last_sale_date).getFullYear()}` : ""}</div>}
    </IntelPanel>
  );
}

export function MetricsRow({ lead }: { lead: MarketplaceLead }) {
  const items = [
    lead.zip_heat_index !== null && { icon: TrendingUp, label: "ZIP heat", value: `${lead.zip_heat_index} signals` },
    lead.nearby_signal_count !== null && { icon: MapPin, label: "Nearby", value: `${lead.nearby_signal_count} in radius` },
    lead.signal_velocity !== null && { icon: Calendar, label: "Velocity", value: `${lead.signal_velocity.toFixed(1)}/wk` },
  ].filter(Boolean) as Array<{ icon: typeof TrendingUp; label: string; value: string }>;

  if (!items.length) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div key={it.label} className="text-center p-2 border border-border/40 rounded bg-muted/10">
            <Icon className="w-3 h-3 mx-auto text-intel-teal mb-1" />
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider">{it.label}</div>
            <div className="text-xs font-mono text-foreground font-bold">{it.value}</div>
          </div>
        );
      })}
    </div>
  );
}

export function TcpaBadge({ clear }: { clear: boolean | null }) {
  if (clear === null) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider", clear ? "text-emerald-400" : "text-orange-400")}>
      <ShieldCheck className="w-3 h-3" />
      {clear ? "TCPA Clear" : "Verify Consent"}
    </span>
  );
}
