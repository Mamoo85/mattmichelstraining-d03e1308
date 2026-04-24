import { Card } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import { BuyerChip, TierBadge, type MarketplaceLead } from "./GoldenTicketCard";
import { cn } from "@/lib/utils";

interface Props {
  lead: MarketplaceLead;
  className?: string;
}

/** Explicit SOLD state on the marketplace — prevents broken-looking cards after a claim. */
export function SoldDossierCard({ lead, className }: Props) {
  const locationLine = [lead.city, lead.state, lead.zip].filter(Boolean).join(", ");

  return (
    <Card className={cn(
      "relative overflow-hidden bg-card/40 border-border/30 grayscale hover:grayscale-0 transition-all opacity-70",
      className
    )}>
      <div className="absolute top-3 right-3 px-3 py-1 bg-muted border-2 border-foreground/30 rounded font-mono text-xs font-bold text-foreground uppercase tracking-widest rotate-[-8deg]">
        SOLD
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <TierBadge tier={lead.signal_strength_tier} />
          {lead.buyer_type && <BuyerChip>{lead.buyer_type}</BuyerChip>}
        </div>

        {lead.human_summary && (
          <p className="text-sm text-muted-foreground line-clamp-2">{lead.human_summary}</p>
        )}

        <div className="text-xs font-mono text-muted-foreground">
          {locationLine || "Metro Detroit"}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border/30 text-xs text-muted-foreground">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/70" />
          <span>Claimed by another buyer</span>
        </div>
      </div>
    </Card>
  );
}
