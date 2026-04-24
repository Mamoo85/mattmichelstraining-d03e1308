import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity } from "lucide-react";

interface Props {
  product: string;
  totalLeads: number;
  hotCount: number;
}

/**
 * Rotating live-stat strip. Pulls real numbers from existing tables.
 * No new schema. Refreshes every 60s.
 */
export function LiveActivityTicker({ product, totalLeads, hotCount }: Props) {
  const [soldLastHour, setSoldLastHour] = useState<number | null>(null);
  const [viewersNow, setViewersNow] = useState<number | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const [soldRes, viewersRes] = await Promise.allSettled([
        (supabase as any)
          .from("marketplace_lead_locks")
          .select("lead_id", { count: "exact", head: true })
          .eq("product", product)
          .eq("status", "sold")
          .gte("created_at", oneHourAgo),
        (supabase as any)
          .from("marketplace_buyer_views")
          .select("visitor_hash")
          .eq("product", product)
          .gte("viewed_at", thirtyMinAgo),
      ]);
      if (cancelled) return;
      if (soldRes.status === "fulfilled") setSoldLastHour(soldRes.value.count ?? 0);
      if (viewersRes.status === "fulfilled" && viewersRes.value.data) {
        const unique = new Set(viewersRes.value.data.map((r: any) => r.visitor_hash)).size;
        setViewersNow(unique);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [product]);

  // Build messages — only show ones with real data
  const messages = [
    `${totalLeads} live · ${hotCount} HOT right now`,
    soldLastHour !== null && soldLastHour > 0 ? `${soldLastHour} lead${soldLastHour === 1 ? "" : "s"} sold in the last hour` : null,
    viewersNow !== null && viewersNow > 1 ? `${viewersNow} buyers browsing now` : null,
    "Refund if uncontactable · single-buyer guarantee",
  ].filter(Boolean) as string[];

  useEffect(() => {
    if (messages.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % messages.length), 4000);
    return () => clearInterval(t);
  }, [messages.length]);

  return (
    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-intel-teal/10 border border-intel-teal/30 text-[11px] font-mono uppercase tracking-wider text-intel-teal">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-intel-teal opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-intel-teal" />
      </span>
      <Activity className="w-3 h-3" />
      <span key={idx} className="animate-in fade-in slide-in-from-bottom-1 duration-500">
        {messages[idx] || messages[0]}
      </span>
    </div>
  );
}
