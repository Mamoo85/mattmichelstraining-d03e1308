import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RankingSnapshot {
  keyword: string;
  position: number;
  local_pack: boolean;
  checked_at: string;
}

const ClientCommandCenter = () => {
  const [rankings, setRankings] = useState<RankingSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchRankings = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("client-rankings-fetch");
        if (error) throw error;
        setRankings(data?.rankings ?? []);
      } catch (err: any) {
        toast({ title: "Error loading rankings", description: err.message, variant: "destructive" });
      }
      setLoading(false);
    };
    fetchRankings();
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0f" }}>
      <div className="container max-w-5xl mx-auto px-4 pt-32 pb-20">
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2" style={{ color: "#f8fafc" }}>Command Center</h1>
          <p style={{ color: "#64748b" }}>Your live keyword rankings and local search performance.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#22d3ee" }} />
          </div>
        ) : rankings.length === 0 ? (
          <div className="rounded-xl p-12 text-center" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.08)" }}>
            <p className="text-lg font-semibold mb-2" style={{ color: "#e2e8f0" }}>No ranking data yet</p>
            <p className="text-sm" style={{ color: "#64748b" }}>Rankings are updated weekly. Check back soon or contact us to set up keyword tracking.</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.08)" }}>
            <div className="grid grid-cols-4 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "#475569", borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
              <span>Keyword</span>
              <span className="text-center">Position</span>
              <span className="text-center">Local Pack</span>
              <span className="text-right">Last Checked</span>
            </div>
            {rankings.map((r, i) => (
              <div key={i} className="grid grid-cols-4 items-center px-6 py-4" style={{ borderBottom: "1px solid rgba(148,163,184,0.04)" }}>
                <span className="text-sm font-medium" style={{ color: "#e2e8f0" }}>{r.keyword}</span>
                <div className="flex items-center justify-center gap-1">
                  {r.position <= 3 ? <TrendingUp className="h-4 w-4" style={{ color: "#22c55e" }} /> : r.position <= 10 ? <Minus className="h-4 w-4" style={{ color: "#eab308" }} /> : <TrendingDown className="h-4 w-4" style={{ color: "#f87171" }} />}
                  <span className="text-sm font-bold" style={{ color: r.position <= 3 ? "#22c55e" : r.position <= 10 ? "#eab308" : "#f87171" }}>#{r.position}</span>
                </div>
                <div className="text-center">
                  {r.local_pack ? <MapPin className="h-4 w-4 mx-auto" style={{ color: "#22d3ee" }} /> : <span className="text-xs" style={{ color: "#475569" }}>—</span>}
                </div>
                <span className="text-xs text-right" style={{ color: "#64748b" }}>{new Date(r.checked_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientCommandCenter;
