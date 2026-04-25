import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Bookmark, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Link } from "react-router-dom";

interface WatchedLead {
  lead_id: string;
  product: string;
  last_price_cents: number | null;
  current_price_cents: number | null;
  human_summary: string | null;
  city: string | null;
  zip: string | null;
  score: number | null;
}

export function WatchedLeadsRail({ buyerEmail }: { buyerEmail: string }) {
  const [leads, setLeads] = useState<WatchedLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!buyerEmail) { setLoading(false); return; }
    supabase.functions.invoke("marketplace-watched-leads", { body: { buyer_email: buyerEmail } })
      .then(({ data }) => setLeads(((data as any)?.leads || []) as WatchedLead[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [buyerEmail]);

  if (loading || leads.length === 0) return null;

  return (
    <div className="container max-w-5xl mx-auto px-4 mt-8">
      <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-intel-teal mb-3">
        <Bookmark className="w-3.5 h-3.5" /> Your watched leads
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {leads.map((l) => {
          const last = l.last_price_cents ?? 0;
          const cur = l.current_price_cents ?? last;
          const trend = cur < last ? "down" : cur > last ? "up" : "flat";
          const Icon = trend === "down" ? TrendingDown : trend === "up" ? TrendingUp : Minus;
          const color = trend === "down" ? "text-emerald-400" : trend === "up" ? "text-orange-400" : "text-muted-foreground";
          return (
            <Card key={l.lead_id} className="p-3 bg-card/60 border-border/40 hover:border-intel-teal/50 transition-colors">
              <Link to={`/lead/${l.lead_id}`} className="block">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {l.product} · {l.city || l.zip || "Detroit"}
                  </span>
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                </div>
                {l.human_summary && (
                  <p className="text-xs text-foreground/80 line-clamp-2 mb-2">{l.human_summary}</p>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-muted-foreground">Score {l.score || "?"}/10</span>
                  <span className={`font-bold ${color}`}>${(cur / 100).toFixed(0)}</span>
                </div>
              </Link>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
