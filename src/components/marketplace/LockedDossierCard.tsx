import { Lock, Eye, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import ActionButton from "@/components/ui/action-button";
import { BuyerChip, FreshnessBadge, TierBadge, ScoreBars, EquityPanel, MetricsRow, TcpaBadge, type MarketplaceLead } from "./GoldenTicketCard";
import { SourceIconRow } from "./SourceIconRow";
import { cn } from "@/lib/utils";

interface Props {
  lead: MarketplaceLead;
  priceCents?: number;
  onClaim?: (lead: MarketplaceLead) => void | Promise<unknown>;
  className?: string;
  viewersNow?: number;
}

export function LockedDossierCard({ lead, priceCents = 4900, onClaim, className, viewersNow = 0 }: Props) {
  const viewers = viewersNow;

  const price = (priceCents / 100).toFixed(0);
  const locationLine = [lead.city, lead.state, lead.zip].filter(Boolean).join(", ");

  return (
    <Card className={cn(
      "relative overflow-hidden bg-gradient-to-br from-card via-card to-background border-border/60",
      "hover:border-intel-teal/50 transition-all duration-300",
      lead.signal_strength_tier === "hot" && "animate-dossier-glow",
      className
    )}>
      {/* Scanline shimmer overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-intel-teal to-transparent animate-scanline" />
      </div>

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border/40 flex items-start justify-between gap-2">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <TierBadge tier={lead.signal_strength_tier} />
            <FreshnessBadge days={lead.days_on_radar} />
          </div>
          {lead.buyer_type && <BuyerChip>{lead.buyer_type}</BuyerChip>}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[10px] uppercase font-mono text-muted-foreground tracking-wider">Lead #{lead.id.slice(0, 6).toUpperCase()}</div>
          {viewers > 1 && (
            <div className="text-[10px] font-mono text-orange-400 mt-1 flex items-center gap-1 justify-end">
              <Eye className="w-3 h-3" /> {viewers} viewing
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Summary — the headline */}
        {lead.human_summary && (
          <p className="text-sm text-foreground leading-relaxed">
            {lead.human_summary}
          </p>
        )}

        {/* Location (intel-redacted, not a placeholder) */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono">
            <Lock className="w-3 h-3 text-seal-gold flex-shrink-0" />
            <span className="text-seal-gold uppercase tracking-wider">Address redacted</span>
            <span className="text-muted-foreground">·</span>
            <MapPin className="w-3 h-3 text-muted-foreground" />
            <span className="text-foreground truncate">{locationLine || "Metro Detroit"}</span>
          </div>
          {(lead.nearby_signal_count ?? 0) > 0 && (
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground pl-5">
              {lead.nearby_signal_count} active signal{lead.nearby_signal_count === 1 ? "" : "s"} within this ZIP · unlocks at purchase
            </p>
          )}
        </div>

        <ScoreBars score={lead.score} percentile={lead.score_percentile} history={lead.score_history} />

        <SourceIconRow sources={lead.provenance_sources || lead.provenance_source_urls} />

        <EquityPanel lead={lead} />

        <MetricsRow lead={lead} />

        <div className="flex items-center justify-between pt-1">
          <TcpaBadge clear={lead.tcpa_clear} />
          <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">
            Source: DWA Scanner
          </span>
        </div>

        {/* Trust footer — verified provenance count + freshness */}
        {(() => {
          const sourceCount = (lead.provenance_sources?.length || lead.provenance_source_urls?.length || 0);
          if (sourceCount === 0) return null;
          return (
            <div className="pt-2 mt-1 border-t border-border/30 flex items-center justify-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <span className="text-intel-teal">✓</span>
              Cross-referenced across {sourceCount} verified source{sourceCount === 1 ? "" : "s"}
            </div>
          );
        })()}
      </div>

      {/* Wax seal CTA */}
      <div className="px-4 pb-4 pt-2 border-t border-border/40 bg-gradient-to-b from-transparent to-seal-gold/5">
        <ActionButton
          onClick={() => onClaim?.(lead)}
          busyLabel="Opening secure checkout…"
          ariaLabel={`Unlock full dossier for $${price}`}
          className="w-full bg-gradient-to-r from-seal-gold to-orange-500 hover:from-seal-gold hover:to-orange-400 text-background font-bold tracking-wide shadow-lg shadow-seal-gold/20"
          style={{ background: undefined, color: undefined, minHeight: 56, fontSize: 16 }}
        >
          <span className="text-lg mr-2">🎟</span>
          Unlock Full Dossier · ${price}
        </ActionButton>
        <p className="text-[10px] text-center text-muted-foreground font-mono mt-2 tracking-wider">
          Single buyer · Once unlocked, this lead is yours
        </p>
      </div>
    </Card>
  );
}
