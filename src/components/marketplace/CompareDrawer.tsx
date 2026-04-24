import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { MarketplaceLead } from "./GoldenTicketCard";
import { TierBadge, ScoreBars, MetricsRow, EquityPanel } from "./GoldenTicketCard";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leads: MarketplaceLead[];
  onRemove: (id: string) => void;
  onClaim: (lead: MarketplaceLead) => void;
}

export function CompareDrawer({ open, onOpenChange, leads, onRemove, onClaim }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto bg-background">
        <SheetHeader>
          <SheetTitle className="font-mono text-sm uppercase tracking-widest text-intel-teal">
            Comparing {leads.length} leads side-by-side
          </SheetTitle>
        </SheetHeader>
        {leads.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Select up to 3 leads using the compare checkbox.
          </div>
        ) : (
          <div className="grid gap-4 mt-4" style={{ gridTemplateColumns: `repeat(${leads.length}, minmax(0, 1fr))` }}>
            {leads.map((lead) => (
              <div key={lead.id} className="border border-border/40 rounded-lg p-4 bg-card/50 space-y-3 relative">
                <button
                  onClick={() => onRemove(lead.id)}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                  aria-label="Remove from comparison"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2">
                  <TierBadge tier={lead.signal_strength_tier} />
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  {lead.city}, {lead.state} {lead.zip}
                </div>
                {lead.human_summary && (
                  <p className="text-sm text-foreground/90">{lead.human_summary}</p>
                )}
                <ScoreBars score={lead.score} percentile={lead.score_percentile} />
                <EquityPanel lead={lead} />
                <MetricsRow lead={lead} />
                <Button
                  size="sm"
                  className="w-full bg-seal-gold text-background hover:bg-seal-gold/90"
                  onClick={() => onClaim(lead)}
                >
                  🎟 Unlock
                </Button>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
