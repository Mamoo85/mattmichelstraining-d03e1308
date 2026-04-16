import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Facility {
  provider_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  overall_rating: number | null;
  staffing_rating: number | null;
  rn_staffing_hours: number | null;
  ownership_type: string | null;
  number_of_beds: number | null;
}

export default function AdminMedicareIntel() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const { toast } = useToast();

  async function fetchData() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("medicare-staffing-intel");
      if (error) throw error;
      setFacilities(data?.facilities || []);
      setTotal(data?.total || 0);
      toast({ title: `Found ${data?.total || 0} understaffed facilities` });
    } catch (e) {
      toast({ title: "Error fetching Medicare data", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function ratingBadge(rating: number | null) {
    if (!rating) return <span className="text-white/30 text-xs">N/A</span>;
    const colors: Record<number, string> = {
      1: "bg-red-500/20 text-red-400 border-red-500/30",
      2: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      3: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      4: "bg-green-500/20 text-green-400 border-green-500/30",
      5: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${colors[rating] || "bg-white/10 text-white/50"}`}>
        {"★".repeat(rating)} {rating}/5
      </span>
    );
  }

  function pitchEmail(f: Facility) {
    const subject = encodeURIComponent(`Staffing Support for ${f.provider_name}`);
    const body = encodeURIComponent(
      `Hi,\n\nI noticed ${f.provider_name} may be looking for qualified nursing staff. We specialize in connecting Michigan healthcare facilities with licensed CNAs, LPNs, and RNs who are actively seeking positions.\n\nOur TechAlert system monitors new license issuances daily and delivers verified, actionable candidate profiles directly to your inbox — complete with contact information and license verification.\n\nWould you have 10 minutes this week for a quick call?\n\nBest,\nMatt Michels\nDetroit Web Agency\n(313) 992-1219\ndetroitwebagent.com`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white/40 text-xs uppercase tracking-wide mb-1">Medicare Care Compare</h2>
          <p className="text-white/60 text-sm">
            Nursing homes with 1-2 Star Staffing Ratings in Metro Detroit — prime TechAlert prospects.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/30 transition-colors text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Scanning CMS…" : total > 0 ? "Refresh Data" : "🔍 Scan Medicare API"}
        </button>
      </div>

      {total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#0f1f35] border border-white/10 rounded-lg p-3">
            <p className="text-white/40 text-xs">Total Found</p>
            <p className="text-2xl font-bold text-white">{total}</p>
          </div>
          <div className="bg-[#0f1f35] border border-red-500/20 rounded-lg p-3">
            <p className="text-white/40 text-xs">1-Star Staffing</p>
            <p className="text-2xl font-bold text-red-400">{facilities.filter(f => f.staffing_rating === 1).length}</p>
          </div>
          <div className="bg-[#0f1f35] border border-orange-500/20 rounded-lg p-3">
            <p className="text-white/40 text-xs">2-Star Staffing</p>
            <p className="text-2xl font-bold text-orange-400">{facilities.filter(f => f.staffing_rating === 2).length}</p>
          </div>
          <div className="bg-[#0f1f35] border border-[#00d4ff]/20 rounded-lg p-3">
            <p className="text-white/40 text-xs">Avg Beds</p>
            <p className="text-2xl font-bold text-[#00d4ff]">
              {Math.round(facilities.reduce((s, f) => s + (f.number_of_beds || 0), 0) / (facilities.length || 1))}
            </p>
          </div>
        </div>
      )}

      {facilities.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs uppercase border-b border-white/10">
                <th className="text-left py-2 px-3">Facility</th>
                <th className="text-left py-2 px-3">City</th>
                <th className="text-center py-2 px-3">Staffing</th>
                <th className="text-center py-2 px-3">Overall</th>
                <th className="text-center py-2 px-3">Beds</th>
                <th className="text-left py-2 px-3">Phone</th>
                <th className="text-right py-2 px-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {facilities.map((f, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-2.5 px-3">
                    <p className="text-white font-medium text-sm">{f.provider_name}</p>
                    <p className="text-white/40 text-xs">{f.address}</p>
                  </td>
                  <td className="py-2.5 px-3 text-white/60">{f.city}</td>
                  <td className="py-2.5 px-3 text-center">{ratingBadge(f.staffing_rating)}</td>
                  <td className="py-2.5 px-3 text-center">{ratingBadge(f.overall_rating)}</td>
                  <td className="py-2.5 px-3 text-center text-white/60">{f.number_of_beds || "—"}</td>
                  <td className="py-2.5 px-3">
                    {f.phone ? (
                      <a href={`tel:${f.phone}`} className="text-[#00d4ff]/80 hover:text-[#00d4ff] transition-colors">
                        {f.phone}
                      </a>
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => pitchEmail(f)}
                      className="px-3 py-1.5 rounded bg-[#00d4ff]/10 text-[#00d4ff] text-xs font-medium hover:bg-[#00d4ff]/20 transition-colors border border-[#00d4ff]/20"
                    >
                      📧 TechAlert Pitch
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && facilities.length === 0 && total === 0 && (
        <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-8 text-center">
          <p className="text-white/40 text-sm">Click "Scan Medicare API" to find understaffed nursing homes in Metro Detroit.</p>
          <p className="text-white/30 text-xs mt-2">Data source: CMS Medicare Care Compare (free, public, federal)</p>
        </div>
      )}
    </div>
  );
}
