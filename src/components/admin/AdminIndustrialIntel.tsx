import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface IndustrialLead {
  company_name: string;
  location: string;
  expansion_type: string;
  details: string;
  news_date: string | null;
  source_url: string | null;
}

const TYPE_COLORS: Record<string, string> = {
  "New Plant": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "Equipment Acquisition": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Contract Award": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Workforce Expansion": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "Facility Upgrade": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

export default function AdminIndustrialIntel() {
  const [leads, setLeads] = useState<IndustrialLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const { toast } = useToast();

  async function fetchData() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("industrial-growth-intel");
      if (error) throw error;
      setLeads(data?.leads || []);
      setTotal(data?.total || 0);
      toast({ title: `Found ${data?.total || 0} industrial expansion signals` });
    } catch (e) {
      toast({ title: "Error scanning industrial intel", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function typeBadge(type: string) {
    const colors = TYPE_COLORS[type] || "bg-white/10 text-white/50 border-white/20";
    return (
      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${colors}`}>
        {type}
      </span>
    );
  }

  function pitchEmail(lead: IndustrialLead) {
    const subject = encodeURIComponent(`Workforce Solutions for ${lead.company_name}`);
    const body = encodeURIComponent(
      `Hi,\n\nI came across news about ${lead.company_name}'s recent ${lead.expansion_type.toLowerCase()} in ${lead.location}. Congratulations on the growth!\n\nDetroit Web Agency specializes in connecting Metro Detroit industrial companies with licensed, verified tradespeople — Boiler Operators, Master Plumbers, HVAC Technicians, and Electricians.\n\nOur TechAlert system monitors new license issuances from LARA and MIOSHA daily, delivering verified candidate profiles with direct contact information straight to your inbox.\n\nWould you have 10 minutes this week for a quick call?\n\nBest,\nMatt Michels\nDetroit Web Agency\n(313) 992-1219\ndetroitwebagent.com`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white/40 text-xs uppercase tracking-wide mb-1">Industrial Growth Scanner</h2>
          <p className="text-white/60 text-sm">
            Metro Detroit manufacturing expansions, equipment acquisitions & contract awards — prime TechAlert prospects.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/30 transition-colors text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Scanning…" : total > 0 ? "Refresh Data" : "🔍 Scan Industrial News"}
        </button>
      </div>

      {total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#0f1f35] border border-white/10 rounded-lg p-3">
            <p className="text-white/40 text-xs">Total Signals</p>
            <p className="text-2xl font-bold text-white">{total}</p>
          </div>
          <div className="bg-[#0f1f35] border border-emerald-500/20 rounded-lg p-3">
            <p className="text-white/40 text-xs">New Plants</p>
            <p className="text-2xl font-bold text-emerald-400">{leads.filter(l => l.expansion_type === "New Plant").length}</p>
          </div>
          <div className="bg-[#0f1f35] border border-blue-500/20 rounded-lg p-3">
            <p className="text-white/40 text-xs">Equipment</p>
            <p className="text-2xl font-bold text-blue-400">{leads.filter(l => l.expansion_type === "Equipment Acquisition").length}</p>
          </div>
          <div className="bg-[#0f1f35] border border-purple-500/20 rounded-lg p-3">
            <p className="text-white/40 text-xs">Contracts</p>
            <p className="text-2xl font-bold text-purple-400">{leads.filter(l => l.expansion_type === "Contract Award").length}</p>
          </div>
        </div>
      )}

      {leads.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-xs uppercase border-b border-white/10">
                <th className="text-left py-2 px-3">Company</th>
                <th className="text-left py-2 px-3">Location</th>
                <th className="text-center py-2 px-3">Type</th>
                <th className="text-left py-2 px-3">Details</th>
                <th className="text-center py-2 px-3">Date</th>
                <th className="text-right py-2 px-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-2.5 px-3">
                    <p className="text-white font-medium text-sm">{lead.company_name}</p>
                    {lead.source_url && (
                      <a href={lead.source_url} target="_blank" rel="noreferrer" className="text-[#00d4ff]/60 text-xs hover:text-[#00d4ff] transition-colors">
                        Source →
                      </a>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-white/60">{lead.location}</td>
                  <td className="py-2.5 px-3 text-center">{typeBadge(lead.expansion_type)}</td>
                  <td className="py-2.5 px-3 text-white/50 text-xs max-w-xs truncate">{lead.details}</td>
                  <td className="py-2.5 px-3 text-center text-white/40 text-xs">{lead.news_date || "—"}</td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => pitchEmail(lead)}
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

      {!loading && leads.length === 0 && total === 0 && (
        <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-8 text-center">
          <p className="text-white/40 text-sm">Click "Scan Industrial News" to find Metro Detroit companies expanding operations.</p>
          <p className="text-white/30 text-xs mt-2">Uses web intelligence to identify companies that urgently need skilled tradespeople.</p>
        </div>
      )}
    </div>
  );
}
