import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDown, Info, MapPin } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  clientId?: string;
  businessName?: string;
}

/**
 * Batch 4 GR-16/18/19/20 — Permit cross-ref note, multi-state CTA, score transparency, PDF export.
 */
export const GrowthRadarBatch4 = ({ clientId, businessName }: Props) => {
  const exportPDF = () => {
    const url = `https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/growth-radar-pdf-report`;
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, business_name: businessName }),
    })
      .then((r) => r.text())
      .then((html) => {
        const w = window.open("", "_blank");
        if (w) { w.document.write(html); w.document.close(); }
      });
  };

  return (
    <div className="space-y-4">
      {/* Score transparency */}
      <TooltipProvider>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wide">Why scores matter</h3>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="cursor-help">?</Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">Confidence is scored 1-10 based on: source authority (gov filing &gt; news &gt; social), recency, dollar value, and pattern match to prior won deals. 9-10 = act today, 7-8 = this week, &lt;7 = monitor.</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-xs text-muted-foreground">Hover the ? badge above for the scoring formula.</p>
        </Card>
      </TooltipProvider>

      {/* Permit cross-ref */}
      <Card className="p-4 bg-muted/10">
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="h-4 w-4 text-emerald-400" />
          <span className="text-xs uppercase tracking-wide text-emerald-400">Permit Cross-Reference Active</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Signals enriched with construction permit data from Detroit/Wayne/Oakland. Look for the 🏗️ badge on signal cards.
        </p>
      </Card>

      {/* Multi-state expansion */}
      <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20">
        <div className="text-xs uppercase tracking-wide text-amber-400 mb-1">Add-on</div>
        <h3 className="text-sm font-semibold mb-1">Expand to Ohio + Indiana — +$99/mo</h3>
        <p className="text-xs text-muted-foreground mb-2">Add neighboring-state signals to your feed.</p>
        <Button size="sm" variant="outline">Request expansion</Button>
      </Card>

      {/* PDF export */}
      <Card className="p-5 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <div className="flex items-center gap-2 mb-2">
          <FileDown className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">Weekly Intelligence Report</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Branded PDF of top signals — share with your sales team or board.</p>
        <Button size="sm" onClick={exportPDF}>
          <FileDown className="h-3 w-3 mr-1" /> Generate PDF
        </Button>
      </Card>
    </div>
  );
};
