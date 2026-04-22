import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import { Factory, Loader2, ExternalLink, Clock } from "lucide-react";

type Signal = {
  id: string;
  company_name: string;
  industry?: string;
  location?: string;
  confidence?: number;
  predicted_needs?: string[];
  source_summary?: string;
  detected_at: string;
};

type Rfq = {
  id: string;
  title: string;
  agency?: string;
  naics?: string;
  state?: string;
  city?: string;
  url?: string;
  due_at?: string;
  posted_at?: string;
};

export default function MyBuyerRadar() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [client, setClient] = useState<any>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!token) { setLoading(false); return; }
      const { data: c } = await supabase
        .from("industry_pulse_clients" as any)
        .select("*")
        .eq("dashboard_token", token)
        .maybeSingle();
      setClient(c);

      const weekAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data: sigs } = await supabase
        .from("industry_pulse_signals" as any)
        .select("*")
        .gte("detected_at", weekAgo)
        .order("confidence", { ascending: false })
        .limit(50);
      setSignals((sigs as any[]) || []);

      const { data: rs } = await supabase
        .from("buyer_radar_rfqs" as any)
        .select("*")
        .order("detected_at", { ascending: false })
        .limit(20);
      setRfqs((rs as any[]) || []);
      setLoading(false);
    })();
  }, [token]);

  if (!token) {
    return (
      <div className="min-h-screen bg-[#030711] text-white flex items-center justify-center p-6">
        <p>Missing access token. Use the link from your welcome email.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030711] text-white flex items-center justify-center">
        <Loader2 className="animate-spin w-6 h-6 text-[#00d4ff]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030711] text-white">
      <SEOHead title="Your Buyer Radar Dashboard" description="Live buyer-intent signals" />
      <header className="border-b border-[#1e3a5f] bg-[#0a1628]/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-[#00d4ff]" />
            <span className="font-bold">Buyer Radar</span>
          </div>
          <span className="text-sm text-[#94a3b8]">{client?.company_name || "Welcome"}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Buyer Signals (last 14 days)</h2>
            <span className="text-xs text-[#64748b]">{signals.length} signals</span>
          </div>
          {signals.length === 0 ? (
            <p className="text-[#94a3b8] text-sm">No signals yet. New data flows in daily — check back tomorrow.</p>
          ) : (
            <div className="space-y-3">
              {signals.map((s) => {
                const conf = s.confidence ?? 0;
                const color = conf >= 8 ? "#22c55e" : conf >= 5 ? "#00d4ff" : "#94a3b8";
                return (
                  <div key={s.id} className="bg-[#0a1628] border border-[#1e3a5f] rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-bold text-white truncate">{s.company_name}</h3>
                        <p className="text-xs text-[#94a3b8]">{[s.industry, s.location].filter(Boolean).join(" · ")}</p>
                        {s.source_summary && <p className="text-sm text-[#cbd5e1] mt-2">{s.source_summary}</p>}
                        {s.predicted_needs && s.predicted_needs.length > 0 && (
                          <p className="text-xs text-[#00d4ff] mt-2">Predicted needs: {s.predicted_needs.slice(0, 4).join(", ")}</p>
                        )}
                      </div>
                      <span style={{ background: `${color}20`, color }} className="text-xs font-extrabold px-2 py-1 rounded whitespace-nowrap">
                        {conf}/10
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">RFQ Intercept (recent fab-metal bids)</h2>
            <span className="text-xs text-[#64748b]">{rfqs.length} bids</span>
          </div>
          {rfqs.length === 0 ? (
            <p className="text-[#94a3b8] text-sm">No active RFQs in your filter window. Scanner runs daily.</p>
          ) : (
            <div className="space-y-3">
              {rfqs.map((r) => (
                <div key={r.id} className="bg-[#0a1628] border border-[#1e3a5f] rounded-lg p-4">
                  <h3 className="font-bold text-white">{r.title}</h3>
                  <p className="text-xs text-[#94a3b8] mt-1">
                    {[r.agency, r.naics ? `NAICS ${r.naics}` : null, [r.city, r.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs">
                    {r.due_at && <span className="flex items-center gap-1 text-amber-400"><Clock className="w-3 h-3" /> Due {new Date(r.due_at).toLocaleDateString()}</span>}
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#00d4ff] font-semibold">
                        Open bid <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
